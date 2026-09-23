"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type TrendDay = { date: string; dateLabel: string; salesLabel: string; completed: number; height: number };

export function SalesTrend({ days }: { days: TrendDay[] }) {
  return <figure aria-label="Ventas de los últimos siete días">
    <div className="grid h-32 grid-cols-7 items-end gap-2 border-b border-border sm:gap-4">
      {days.map(day => {
        const date = day.dateLabel;
        const label = `${date}: ${day.salesLabel}, ${day.completed} atenciones`;
        return <Tooltip key={day.date}><TooltipTrigger render={<button type="button" aria-label={label} />} className="flex h-full min-w-0 items-end justify-center rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-ring"><span aria-hidden className="w-full max-w-10 rounded-t-sm bg-primary/65" style={{ height: `${day.height}%`, visibility: day.height === 0 ? "hidden" : "visible" }} /></TooltipTrigger><TooltipContent><div><p className="font-medium">{date}</p><p>Ventas: {day.salesLabel}</p><p>Atenciones: {day.completed}</p></div></TooltipContent></Tooltip>;
      })}
    </div>
    <div aria-hidden className="mt-2 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground sm:gap-4">{days.map(day => <span key={day.date}>{day.date.slice(8)}/{day.date.slice(5, 7)}</span>)}</div>
  </figure>;
}
