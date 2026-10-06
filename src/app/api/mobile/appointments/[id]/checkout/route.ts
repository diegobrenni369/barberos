import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CheckoutError, registerCheckout } from "@/lib/checkout";
import { mobileResponse, resolveMobileAccess, mobileBarberScope } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { logFailure } from "@/lib/safe-logging";

export const runtime = "nodejs";
const input = z.object({ paymentMethod: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER"]) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    if (!request.headers.get("content-type")?.includes("application/json")) return mobileResponse({ error: "Formato no válido." }, 400);
    const reader = request.body?.getReader();
    if (!reader) return mobileResponse({ error: "Método no válido." }, 400);
    const decoder = new TextDecoder(); let text = ""; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > 1024) { await reader.cancel(); return mobileResponse({ error: "Solicitud demasiado grande." }, 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    let body: unknown;
    try { body = JSON.parse(text); } catch { return mobileResponse({ error: "Método no válido." }, 400); }
    const parsed = input.safeParse(body);
    if (!parsed.success) return mobileResponse({ error: "Método no válido." }, 400);
    const { id } = await context.params;
    const { barbershopId } = access.membership;
    const appointment = await prisma.appointment.findFirst({ where: { id, barbershopId, ...mobileBarberScope(access) }, select: { updatedAt: true } });
    if (!appointment) return mobileResponse({ error: "Reserva no encontrada." }, 404);
    await registerCheckout(prisma, barbershopId, { appointmentId: id, expectedUpdatedAt: appointment.updatedAt.toISOString(), discountAmount: "0", method: parsed.data.paymentMethod });
    revalidatePath("/agenda"); revalidatePath("/dashboard"); revalidatePath("/cash");
    return mobileResponse({ id, status: "COMPLETED", canCharge: false, canChangeStatus: false, paymentLabel: "Pagada" });
  } catch (error) {
    if (error instanceof CheckoutError) return mobileResponse({ error: "La cita no se puede cobrar. Actualiza la agenda para revisar su estado." }, 409);
    logFailure("checkout_failed");
    return mobileResponse({ error: "No se pudo registrar el cobro." }, 503);
  }
}
