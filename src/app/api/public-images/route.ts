import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_PUBLIC_IMAGE_BYTES, PUBLIC_IMAGE_TYPES } from "@/lib/public-branding";

export const runtime = "nodejs";
const input = z.object({ target: z.enum(["logo", "cover", "barber", "service"]), id: z.string().cuid().optional() }).strict();
const fail = (error: string, status: number) => Response.json({ error }, { status });

async function cleanupImage(url: string) {
  try {
    // Blob enforces access to the configured store; never delete by pathname alone.
    await del(url);
  } catch {
    // Do not log SDK errors: they may contain URLs or credentials.
    console.error(JSON.stringify({ event: "public_image_cleanup_failed", errorId: randomUUID() }));
  }
}

export async function POST(request: Request) {
  // Cookie-authenticated upload endpoint: explicitly reject cross-origin requests.
  const origin = process.env.APP_URL || new URL(request.url).origin;
  if (request.headers.get("origin") !== new URL(origin).origin) return fail("Solicitud no permitida.", 403);
  const member = await getCurrentMembership();
  if (!member || member.role !== "OWNER" || !member.barbershop.isActive) return fail("No tienes permiso para subir imágenes.", 403);
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail("Destino de imagen inválido.", 400);
  const { target, id } = parsed.data;
  const shopId = member.barbershopId;
  const where = { id, barbershopId: shopId };
  const record = target === "barber" ? id && await prisma.barber.findFirst({ where, select: { publicImageUrl: true } })
    : target === "service" ? id && await prisma.service.findFirst({ where, select: { publicImageUrl: true } })
      : { publicImageUrl: target === "logo" ? member.barbershop.logoUrl : member.barbershop.coverImageUrl };
  if (!record) return fail("Registro no encontrado.", 404);
  const remove = request.headers.get("x-remove-image") === "true";
  let bytes: Buffer | undefined;
  if (!remove) {
    if (!PUBLIC_IMAGE_TYPES.includes(request.headers.get("content-type") || "")) return fail("Usa una imagen JPEG, PNG o WebP.", 400);
    if (Number(request.headers.get("content-length")) > MAX_PUBLIC_IMAGE_BYTES) return fail("La imagen debe pesar como máximo 3 MB.", 413);
    const reader = request.body?.getReader();
    if (!reader) return fail("Selecciona una imagen.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_PUBLIC_IMAGE_BYTES) { await reader.cancel(); return fail("La imagen debe pesar como máximo 3 MB.", 413); }
        chunks.push(chunk.value);
      }
      const raw = Buffer.concat(chunks);
      const image = sharp(raw, { limitInputPixels: 16_000_000, failOn: "warning" });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) > 1) return fail("Solo se permiten imágenes JPEG, PNG o WebP estáticas.", 400);
      // Decode fully and strip metadata; never publish SVG/HTML or trust extensions.
      bytes = await image.rotate().webp().toBuffer();
      if (bytes.length > MAX_PUBLIC_IMAGE_BYTES) return fail("La imagen es demasiado grande. Usa una versión más pequeña.", 413);
    } catch { return fail("No se pudo leer la imagen. Usa un archivo válido de hasta 16 megapíxeles.", 400); }
  }
  const prefix = `branding/${shopId}/${target}/${id || shopId}/`;
  const old = record.publicImageUrl;
  let url: string | null = null;
  try {
    if (bytes) url = (await put(`${prefix}${randomUUID()}.webp`, bytes, { access: "public", contentType: "image/webp", addRandomSuffix: true })).url;
    // Compare-and-set protects against overlapping uploads/removals.
    const result = target === "barber"
      ? await prisma.barber.updateMany({ where: { ...where, publicImageUrl: old }, data: { publicImageUrl: url } })
      : target === "service"
        ? await prisma.service.updateMany({ where: { ...where, publicImageUrl: old }, data: { publicImageUrl: url } })
        : await prisma.barbershop.updateMany({ where: { id: shopId, [target === "logo" ? "logoUrl" : "coverImageUrl"]: old }, data: { [target === "logo" ? "logoUrl" : "coverImageUrl"]: url } });
    if (!result.count) {
      if (url) await cleanupImage(url);
      return fail("La imagen cambió mientras subías. Recarga y vuelve a intentarlo.", 409);
    }
  } catch {
    if (url) await cleanupImage(url);
    return fail("No se pudo guardar la imagen. Comprueba la conexión y la configuración de Vercel Blob.", 503);
  }
  // The new URL (or removal) is committed. Cleanup must never enter the rollback
  // path above or invalidate the new image, even when the old Blob cannot be deleted.
  if (old && old !== url) {
    let previous: URL | undefined;
    try { previous = new URL(old); } catch { /* Legacy/non-Blob value: do not delete. */ }
    if (previous?.protocol === "https:" && previous.hostname.endsWith(".public.blob.vercel-storage.com") && previous.pathname.startsWith(`/${prefix}`)) {
      await cleanupImage(old);
    }
  }
  revalidatePath("/settings"); revalidatePath("/services");
  if (target === "barber") revalidatePath(`/barbers/${id}`);
  revalidatePath(`/book/${member.barbershop.slug}`);
  return Response.json({ url });
}
