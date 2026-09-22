"use client";

import { useId, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { agendaHref, calendarDate, civilDate } from "@/lib/agenda-navigation";
import type { AgendaOption } from "@/components/agenda/appointment-dialog";

export function AgendaPanel({ date, today, barbers, selectedIds }: {
  date: string;
  today: string;
  barbers: AgendaOption[];
  selectedIds: string[];
}) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(() => calendarDate(date));

  function navigate(changes: Record<string, string | null>, selectedDate = date) {
    startTransition(() => router.push(agendaHref(params.toString(), selectedDate, changes), { scroll: false }));
  }

  function filterBarbers(ids: string[]) {
    // Filtering already-loaded columns does not need a server round trip.
    window.history.pushState(null, "", agendaHref(params.toString(), date, {
      barbers: ids.length === barbers.length ? null : ids.join(","),
    }));
  }

  return (
    <div aria-busy={pending}>
      <div className="px-4 py-5">
      <Calendar
        mode="single"
        locale={es}
        weekStartsOn={1}
        month={month}
        onMonthChange={setMonth}
        selected={calendarDate(date)}
        today={calendarDate(today)}
        onSelect={(value) => { if (value) navigate({}, civilDate(value)); }}
        disabled={pending}
        className="w-full bg-transparent p-0 [--cell-size:--spacing(8)]"
      />
      </div>
      <Separator />
      <section className="space-y-3 px-5 py-5" aria-labelledby={`${id}-barbers`}>
        <div className="flex items-center justify-between">
          <h3 id={`${id}-barbers`} className="text-xs font-medium text-muted-foreground">Barberos</h3>
          <Button variant="ghost" size="xs" onClick={() => filterBarbers(barbers.map(barber => barber.id))} disabled={pending || selectedIds.length === barbers.length}>Todos</Button>
        </div>
        {barbers.map(barber => (
          <label key={barber.id} className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
            <Checkbox checked={selectedIds.includes(barber.id)} disabled={pending} onCheckedChange={(checked) => filterBarbers(checked ? [...selectedIds, barber.id] : selectedIds.filter(value => value !== barber.id))} />
            <span className="min-w-0 truncate">{barber.name}</span>
          </label>
        ))}
        {barbers.length === 0 && <p className="text-xs text-muted-foreground">No hay barberos activos.</p>}
      </section>
      <Separator />
      <section className="space-y-3 px-5 py-5" aria-labelledby={`${id}-options`}>
        <h3 id={`${id}-options`} className="text-xs font-medium text-muted-foreground">Opciones</h3>
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
          <Checkbox checked={params.get("cancelled") === "true"} disabled={pending} onCheckedChange={(checked) => navigate({ cancelled: checked ? "true" : null })} />
          Mostrar canceladas
        </label>
      </section>
    </div>
  );
}
