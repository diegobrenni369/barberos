"use client";
import { DatePicker } from "@/components/ui/date-picker";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const periods = [
  { value: "current", label: "Este mes" },
  { value: "previous", label: "Mes anterior" },
  { value: "custom", label: "Rango personalizado" },
];

export function CommissionPeriodFilter({ initialPeriod, start, end }: { initialPeriod: string; start: string; end: string }) {
  const [period, setPeriod] = useState(initialPeriod);
  const periodId = useId();
  return <form className="flex flex-wrap items-end gap-3" action="/commissions">
    <div className="grid gap-1 text-sm">
      <label htmlFor={periodId}>Período</label>
      <Select name="period" items={periods} value={period} onValueChange={value => { if (value) setPeriod(value); }}>
        <SelectTrigger id={periodId} className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {periods.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {period === "custom" && <><label className="grid min-w-0 gap-1 text-sm">Desde<DatePicker required name="start" label="Desde" defaultValue={start} /></label><label className="grid min-w-0 gap-1 text-sm">Hasta<DatePicker required name="end" label="Hasta" defaultValue={end} /></label></>}
    <Button type="submit" variant="outline">Aplicar</Button>
  </form>;
}
