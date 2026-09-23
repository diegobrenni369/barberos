import type { Prisma } from "@prisma/client";

// Shared financial scope for Caja and Dashboard: sales, not payments or appointments.
export function validSalesInRange(barbershopId: string, start: Date, end: Date): Prisma.SaleWhereInput {
  return { barbershopId, status: "COMPLETED", createdAt: { gte: start, lt: end } };
}
