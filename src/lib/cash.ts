export const paymentMethods = {
  CASH: "Efectivo", DEBIT_CARD: "Débito", CREDIT_CARD: "Crédito", TRANSFER: "Transferencia",
} as const;
export type CashPaymentMethod = keyof typeof paymentMethods;

// Conversion is display-only; persisted calculations use Prisma.Decimal.
export function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(Number(value));
}

export type SaleDetailsData = {
  id: string; customerName: string; barberName: string; currency: string; createdAt: string;
  subtotal: string; discountAmount: string; total: string; status: string;
  items: { id: string; description: string; quantity: number; unitPrice: string; subtotal: string }[];
  payments: { id: string; method: CashPaymentMethod; amount: string }[];
  commission: { rate: string; baseAmount: string; amount: string } | null;
};
