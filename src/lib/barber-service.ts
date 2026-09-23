import type { Prisma } from "@prisma/client";

export const BARBER_SERVICE_MESSAGE = "Este profesional no realiza este servicio.";

export async function ensureBarberService(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, serviceId: string) {
  const link = await tx.barberService.findFirst({
    where: { barbershopId, barberId, serviceId, barber: { isActive: true }, service: { isActive: true } },
    select: { id: true },
  });
  if (!link) throw new Error("BARBER_SERVICE_INELIGIBLE");
}

// Active selections are editable; inactive existing links survive reactivation.
// The caller supplies the tenant from authenticated membership, never FormData.
export async function setServiceBarbers(tx: Prisma.TransactionClient, barbershopId: string, serviceId: string, barberIds: string[], reservable: boolean) {
  const service = await tx.service.findFirst({ where: { id: serviceId, barbershopId }, select: { id: true } });
  if (!service) throw new Error("Servicio no encontrado");
  const ids = [...new Set(barberIds)];
  const active = await tx.barber.count({ where: { id: { in: ids }, barbershopId, isActive: true } });
  if (active !== ids.length) throw new Error("Selecciona profesionales activos de tu barbería.");
  if (reservable && !active) throw new Error("Selecciona al menos un profesional activo para habilitar la reserva online.");
  await tx.barberService.deleteMany({ where: { barbershopId, serviceId, barber: { isActive: true }, barberId: { notIn: ids } } });
  await tx.barberService.createMany({ data: ids.map(barberId => ({ barbershopId, serviceId, barberId })), skipDuplicates: true });
}
