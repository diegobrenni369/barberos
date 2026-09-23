"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SaleDetailsData } from "@/lib/cash";

export async function getAppointmentSale(appointmentId: string): Promise<{ sale: SaleDetailsData; timezone: string } | null> {
  const membership = await requireRole("OWNER");
  if (typeof appointmentId !== "string" || !appointmentId || appointmentId.length > 100) return null;
  const sale = await prisma.sale.findFirst({
    where: { appointmentId, barbershopId: membership.barbershopId },
    include: { items: true, payments: true, commission: true },
  });
  if (!sale) return null;
  return { timezone: membership.barbershop.timezone, sale: {
    id: sale.id, customerName: sale.customerName, barberName: sale.barberName,
    currency: sale.currency, createdAt: sale.createdAt.toISOString(), status: sale.status,
    subtotal: sale.subtotal.toString(), discountAmount: sale.discountAmount.toString(), total: sale.total.toString(),
    items: sale.items.map(item => ({ id: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })),
    payments: sale.payments.map(payment => ({ id: payment.id, method: payment.method, amount: payment.amount.toString() })),
    commission: sale.commission ? { rate: sale.commission.rate.toString(), baseAmount: sale.commission.baseAmount.toString(), amount: sale.commission.amount.toString() } : null,
  } };
}
