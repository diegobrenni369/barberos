import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mobileResponse, resolveMobileAccess } from "@/lib/mobile-auth";
import { lockAppointment, syncAppointmentReminders } from "@/lib/appointment-reminders";
import { ensureBarberAvailable, ensureNoBarberBlock, ensureNoBarberBreak } from "@/lib/barber-availability";
import { ensureNoOverlap } from "@/lib/appointment-overlap";

export const runtime = "nodejs";
const input = z.object({ status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW"]) }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    if (!request.headers.get("content-type")?.includes("application/json")) return mobileResponse({ error: "Formato no válido." }, 400);
    // Bound the actual stream, not just the caller-controlled Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return mobileResponse({ error: "Estado no válido." }, 400);
    let text = ""; let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 1024) { await reader.cancel(); return mobileResponse({ error: "Solicitud demasiado grande." }, 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    let body: unknown;
    try { body = JSON.parse(text); } catch { return mobileResponse({ error: "Estado no válido." }, 400); }
    const parsed = input.safeParse(body);
    if (!parsed.success) return mobileResponse({ error: "Estado no válido." }, 400);
    const { id } = await context.params;
    const { barbershopId, barbershop } = access.membership;
    const status = parsed.data.status;
    const result = await prisma.$transaction(async tx => {
      await lockAppointment(tx, id, barbershopId);
      const current = await tx.appointment.findFirst({ where: { id, barbershopId, barber: { barbershopId }, customer: { barbershopId }, service: { barbershopId } }, include: { sale: { select: { id: true } }, barber: true, customer: true, service: true } });
      if (!current) return { error: "Reserva no encontrada.", code: 404 } as const;
      if (current.sale || !["SCHEDULED", "CONFIRMED"].includes(current.status) || (status === "CONFIRMED" && current.status !== "SCHEDULED")) return { error: "La reserva cambió o no permite esta acción. Actualiza la agenda.", code: 409 } as const;
      if (!current.barber.isActive || !current.customer.isActive || !current.service.isActive) return { error: "El profesional, cliente o servicio no está activo.", code: 409 } as const;
      if (status !== "CANCELLED") {
        const args = { barbershopId, barberId: current.barberId, startsAt: current.startsAt, endsAt: current.endsAt, timezone: barbershop.timezone };
        await ensureBarberAvailable(tx, args);
        await ensureNoBarberBreak(tx, args);
        await ensureNoBarberBlock(tx, args);
        await ensureNoOverlap(tx, barbershopId, current.barberId, current.startsAt, current.endsAt, id);
      }
      await tx.appointment.update({ where: { id, barbershopId }, data: { status } });
      await syncAppointmentReminders(tx, barbershopId, id, current);
      return { id, status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in result) return mobileResponse({ error: result.error }, result.code);
    revalidatePath("/agenda"); revalidatePath("/dashboard");
    return mobileResponse(result);
  } catch (error) {
    const conflicts = ["BARBERSHOP_CLOSED", "OUTSIDE_BUSINESS_HOURS", "OUTSIDE_AVAILABILITY", "BARBER_BREAK", "BARBER_BLOCKED", "APPOINTMENT_OVERLAP"];
    if (error instanceof Error && (conflicts.includes(error.message) || (error as { code?: string }).code === "P2034")) return mobileResponse({ error: "La reserva cambió o el horario no está disponible. Actualiza la agenda." }, 409);
    return mobileResponse({ error: "No se pudo actualizar la reserva." }, 503);
  }
}
