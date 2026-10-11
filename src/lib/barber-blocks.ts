import { AppointmentStatus, type Prisma } from "@prisma/client";

export async function removeBarberBlock(tx: Prisma.TransactionClient, scope: { barbershopId: string; barberId?: string }, id: string) {
  return tx.barberBlock.deleteMany({ where: { ...scope, id } });
}

export async function ensureNoActiveAppointment(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, startsAt: Date, endsAt: Date) {
  const appointment = await tx.appointment.findFirst({ where: { barbershopId, barberId, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
  if (appointment) throw new Error("ACTIVE_APPOINTMENT");
}
