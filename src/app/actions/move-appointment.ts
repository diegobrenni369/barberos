"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moveAppointmentInTransaction } from "@/lib/move-appointment";

const schema = z.object({
  id: z.string().min(1), barberId: z.string().min(1),
  date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  expectedUpdatedAt: z.iso.datetime(),
});

const messages: Record<string, string> = {
  APPOINTMENT_NOT_FOUND: "Reserva no encontrada.",
  STALE_APPOINTMENT: "La reserva cambió. Actualiza la agenda antes de moverla.",
  APPOINTMENT_NOT_MOVABLE: "Solo puedes mover reservas agendadas o confirmadas.",
  BARBER_INACTIVE: "El barbero no está activo.",
  SERVICE_INACTIVE: "El servicio no está activo.",
  BARBER_SERVICE_INELIGIBLE: "Este profesional no realiza este servicio.",
  INVALID_TIME: "La hora seleccionada no existe en esta fecha.",
  BARBERSHOP_CLOSED: "La barbería está cerrada.",
  OUTSIDE_BUSINESS_HOURS: "Fuera del horario de atención.",
  OUTSIDE_AVAILABILITY: "No disponible en ese horario.",
  BARBER_BREAK: "El barbero tiene un descanso.",
  BARBER_BLOCKED: "El barbero tiene un bloqueo.",
  APPOINTMENT_OVERLAP: "Existe otra reserva en ese horario.",
};

export async function moveAppointment(input: unknown) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Los datos del movimiento no son válidos." };
  try {
    await prisma.$transaction(tx => moveAppointmentInTransaction(tx, { barbershopId: membership.barbershopId, timezone: membership.barbershop.timezone }, parsed.data), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { ok: false, error: "La agenda cambió. Intenta nuevamente." };
    if (error instanceof Error && messages[error.message]) return { ok: false, error: messages[error.message] };
    console.error("Error moving appointment", error);
    return { ok: false, error: "No se pudo mover la reserva. Intenta nuevamente." };
  }
  revalidatePath("/dashboard"); revalidatePath("/agenda");
  return { ok: true };
}
