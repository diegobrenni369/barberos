import { Prisma } from "@prisma/client";

type SaleBalanceInput = {
  total: Prisma.Decimal | string;
  payments: readonly { amount: Prisma.Decimal | string }[];
};

// Payments represent recorded money, not pending gateway attempts.
export function getPaidAmount(sale: SaleBalanceInput): Prisma.Decimal {
  return sale.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
}

export function getRemainingAmount(sale: SaleBalanceInput): Prisma.Decimal {
  return Prisma.Decimal.max(new Prisma.Decimal(sale.total).minus(getPaidAmount(sale)), 0);
}

export function isSalePaid(sale: SaleBalanceInput): boolean {
  return getPaidAmount(sale).gte(sale.total);
}

export function getSalePaymentLabel(sale: SaleBalanceInput & { status: string }): string {
  if (sale.status === "VOIDED") return "Venta anulada";
  // A zero-total sale has no outstanding balance, even with no payments.
  if (isSalePaid(sale)) return "Pagada";
  return getPaidAmount(sale).gt(0) ? "Parcialmente pagada" : "Pendiente de pago";
}
