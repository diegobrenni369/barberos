import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mobileResponse, resolveMobileAccess } from "@/lib/mobile-auth";
import { mobileBookingBody } from "@/lib/mobile-booking-http";
import { MobileBookingError } from "@/lib/mobile-booking";
import { settlementInput, settleCommissions, SettlementError } from "@/lib/commissions";
import { prisma } from "@/lib/prisma";
import { logFailure } from "@/lib/safe-logging";

export const runtime = "nodejs";
const input = z.object({ barberId: settlementInput.shape.barberId, from: settlementInput.shape.start, to: settlementInput.shape.end }).strict();

export async function POST(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    if (access.role !== "OWNER") return mobileResponse({ error: "Solo el propietario puede registrar liquidaciones." }, 403);
    const parsed = input.safeParse(await mobileBookingBody(request));
    if (!parsed.success || parsed.data.from > parsed.data.to) return mobileResponse({ error: "Revisa el profesional y el rango de fechas." }, 400);
    const { barberId, from, to } = parsed.data;
    const barber = await prisma.barber.findFirst({ where: { id: barberId, barbershopId: access.barbershopId, isActive: true }, select: { id: true } });
    if (!barber) return mobileResponse({ error: "Profesional no encontrado." }, 404);
    const settlement = await settleCommissions(prisma, access.barbershopId, { barberId, start: from, end: to });
    revalidatePath("/commissions");
    revalidatePath("/barbers", "layout");
    return mobileResponse({ id: settlement.id, total: settlement.totalCommission.toString(), currency: settlement.currency });
  } catch (error) {
    if (error instanceof MobileBookingError) return mobileResponse({ error: error.message }, error.status);
    if (error instanceof SettlementError) return mobileResponse({ error: "No se pudo liquidar. Actualiza las comisiones antes de reintentar." }, 409);
    logFailure("request_failed");
    return mobileResponse({ error: "No se pudo registrar la liquidación." }, 503);
  }
}
