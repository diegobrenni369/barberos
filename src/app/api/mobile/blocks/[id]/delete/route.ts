import { revalidatePath } from "next/cache";
import { mobileBarberScope, mobileResponse, resolveMobileAccess } from "@/lib/mobile-auth";
import { removeBarberBlock } from "@/lib/barber-blocks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST keeps compatibility with the existing Mobile request client.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const { id } = await params;
    const result = await removeBarberBlock(prisma, { barbershopId: access.barbershopId, ...mobileBarberScope(access) }, id);
    if (!result.count) return mobileResponse({ error: "Bloqueo no disponible." }, 404);
    revalidatePath("/agenda");
    return mobileResponse({ id });
  } catch {
    return mobileResponse({ error: "No se pudo eliminar el bloqueo." }, 503);
  }
}
