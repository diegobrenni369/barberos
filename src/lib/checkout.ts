import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

export const checkoutSchema = z.object({
  appointmentId: z.string().min(1).max(100),
  expectedUpdatedAt: z.iso.datetime(),
  discountAmount: z.string().regex(/^\d{1,10}$/, "Ingresa un descuento en pesos enteros, mayor o igual a cero"),
  method: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER"], "Selecciona un método de pago"),
});

export class CheckoutError extends Error {}

export async function checkoutInTransaction(tx: Prisma.TransactionClient, barbershopId: string, input: z.infer<typeof checkoutSchema>) {
  // Presencial workflow only: completing attention and snapshotting commission here
  // is not a domain requirement for creating a Sale or recording a Payment.
  const appointment = await tx.appointment.findFirst({
    where: { id: input.appointmentId, barbershopId },
    include: { sale: true, barber: true, customer: true, service: true, barbershop: true },
  });
  if (!appointment) throw new CheckoutError("Reserva no encontrada");
  if (appointment.sale) throw new CheckoutError("Esta reserva ya tiene una venta registrada. Actualiza la agenda.");
  if (!["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(appointment.status)) throw new CheckoutError("No se puede cobrar una reserva cancelada o con inasistencia");
  if (appointment.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new CheckoutError("La reserva cambió. Cierra el cobro y actualiza la agenda.");
  if ([appointment.barber, appointment.customer, appointment.service].some(item => item.barbershopId !== barbershopId)) throw new CheckoutError("Los datos de la reserva no pertenecen a esta barbería");
  if (!appointment.barbershop.isActive || appointment.barbershop.currency !== "CLP") throw new CheckoutError("La barbería debe estar activa y configurada en CLP");
  const subtotal = appointment.price;
  const discountAmount = new Prisma.Decimal(input.discountAmount);
  if (subtotal.isNegative() || !subtotal.isInteger()) throw new CheckoutError("El precio de la reserva debe estar expresado en pesos enteros");
  if (discountAmount.isNegative() || discountAmount.gt(subtotal)) throw new CheckoutError("El descuento no puede superar el subtotal ni ser negativo");
  const total = subtotal.minus(discountAmount);
  const rate = appointment.barber.commissionRate;
  if (rate.lt(0) || rate.gt(100)) throw new CheckoutError("La comisión del barbero debe estar entre 0 y 100%");
  // CLP: nearest whole peso, halves round up. Rate is a percentage, not a ratio.
  const amount = total.mul(rate).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const sale = await tx.sale.create({ data: {
    barbershopId, appointmentId: appointment.id, customerId: appointment.customerId, barberId: appointment.barberId,
    customerName: appointment.customer.name, barberName: appointment.barber.name, currency: appointment.barbershop.currency,
    subtotal, discountAmount, total,
    items: { create: { serviceId: appointment.serviceId, description: appointment.service.name, quantity: 1, unitPrice: subtotal, subtotal } },
    payments: { create: { method: input.method, amount: total } },
    commission: { create: { barberId: appointment.barberId, rate, baseAmount: total, amount } },
  } });
  await tx.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
  return sale.id;
}

export async function registerCheckout(db: PrismaClient, barbershopId: string, raw: unknown) {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) throw new CheckoutError(parsed.error.issues[0].message);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(tx => checkoutInTransaction(tx, barbershopId, parsed.data), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034" && attempt < 2) continue;
        if (error.code === "P2002") throw new CheckoutError("Esta reserva ya tiene una venta registrada. Actualiza la agenda.");
        if (error.code === "P2034") throw new CheckoutError("Otro cambio coincidió con el cobro. Actualiza la agenda e intenta nuevamente.");
      }
      throw error;
    }
  }
  throw new CheckoutError("No se pudo registrar el pago");
}
