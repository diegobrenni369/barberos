import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, paymentMethods, type CashPaymentMethod } from "@/lib/cash";

export function CashSummary({ total, methods, currency }: { total: string; methods: Record<CashPaymentMethod, string>; currency: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
          {[{ label: "Ventas del día", value: total }, ...Object.entries(paymentMethods).map(([method, label]) => ({ label, value: methods[method as CashPaymentMethod] }))].map((item, index) => (
            <div key={item.label} className={index === 0 ? "col-span-2 min-w-0 border-b pb-3 lg:col-span-1 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6" : "min-w-0"}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className={`mt-1 tabular-nums ${index === 0 ? "text-xl font-semibold" : "text-lg font-medium"}`}>{formatMoney(item.value, currency)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
