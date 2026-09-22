import { AppointmentStatus, Prisma } from "@prisma/client";

export async function ensureNoOverlap(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  const conflict = await tx.appointment.findFirst({ where: { barbershopId, barberId, status: { not: AppointmentStatus.CANCELLED }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (conflict) throw new Error("APPOINTMENT_OVERLAP");
}
