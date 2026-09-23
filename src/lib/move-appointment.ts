import { Prisma } from "@prisma/client";
import { zonedDateTimeToUtc, utcToZonedParts } from "@/lib/agenda";
import { ensureBarberAvailable, ensureNoBarberBlock, ensureNoBarberBreak } from "@/lib/barber-availability";
import { ensureNoOverlap } from "@/lib/appointment-overlap";
import { ensureBarberService } from "@/lib/barber-service";

// Called inside a SERIALIZABLE transaction. Duration and service come from DB,
// never from the draggable card or client-provided data.
export async function moveAppointmentInTransaction(tx: Prisma.TransactionClient, tenant: { barbershopId: string; timezone: string }, input: { id: string; barberId: string; date: string; time: string; expectedUpdatedAt: string }) {
  const current = await tx.appointment.findFirst({ where: { id: input.id, barbershopId: tenant.barbershopId } });
  if (!current) throw new Error("APPOINTMENT_NOT_FOUND");
  if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new Error("STALE_APPOINTMENT");
  if (current.status !== "SCHEDULED" && current.status !== "CONFIRMED") throw new Error("APPOINTMENT_NOT_MOVABLE");
  const barber = await tx.barber.findFirst({ where: { id: input.barberId, barbershopId: tenant.barbershopId, isActive: true }, select: { id: true } });
  const service = await tx.service.findFirst({ where: { id: current.serviceId, barbershopId: tenant.barbershopId, isActive: true }, select: { id: true } });
  if (!barber) throw new Error("BARBER_INACTIVE");
  if (!service) throw new Error("SERVICE_INACTIVE");
  await ensureBarberService(tx, tenant.barbershopId, input.barberId, current.serviceId);
  const startsAt = zonedDateTimeToUtc(input.date, input.time, tenant.timezone);
  const local = utcToZonedParts(startsAt, tenant.timezone);
  if (local.date !== input.date || local.time !== input.time) throw new Error("INVALID_TIME");
  const endsAt = new Date(startsAt.getTime() + current.endsAt.getTime() - current.startsAt.getTime());
  const args = { ...tenant, barberId: input.barberId, startsAt, endsAt };
  await ensureBarberAvailable(tx, args);
  await ensureNoBarberBreak(tx, args);
  await ensureNoBarberBlock(tx, args);
  await ensureNoOverlap(tx, tenant.barbershopId, input.barberId, startsAt, endsAt, current.id);
  await tx.appointment.updateMany({ where: { id: current.id, barbershopId: tenant.barbershopId, updatedAt: current.updatedAt }, data: { barberId: input.barberId, startsAt, endsAt } });
}
