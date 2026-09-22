"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function shift(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function AgendaToolbar({
  date,
  today,
  onNew,
}: {
  date: string;
  today: string;
  onNew?: () => void;
}) {
  const showCancelled = useSearchParams().get("cancelled") === "true";
  const suffix = showCancelled ? "&cancelled=true" : "";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          nativeButton={false}
          variant="outline"
          size="icon"
          render={<Link href={`/agenda?date=${shift(date, -1)}${suffix}`} />}
        >
          <ChevronLeft />
          <span className="sr-only">Día anterior</span>
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={`/agenda?date=${today}${suffix}`} />}
        >
          Hoy
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          size="icon"
          render={<Link href={`/agenda?date=${shift(date, 1)}${suffix}`} />}
        >
          <ChevronRight />
          <span className="sr-only">Día siguiente</span>
        </Button>
        <form>
          <input
            key={date}
            type="date"
            name="date"
            defaultValue={date}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          />
          {showCancelled && (
            <input type="hidden" name="cancelled" value="true" />
          )}
          <Button type="submit" variant="outline" className="ml-2">
            Ir
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          nativeButton={false}
          variant={showCancelled ? "secondary" : "outline"}
          render={
            <Link
              href={
                showCancelled
                  ? `/agenda?date=${date}`
                  : `/agenda?date=${date}&cancelled=true`
              }
            />
          }
        >
          {showCancelled ? <EyeOff /> : <Eye />}
          {showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
        </Button>
        <Button variant="outline" disabled>
          Día
        </Button>
        <Button onClick={onNew} disabled={!onNew}>
          <Plus />
          Nueva reserva
        </Button>
      </div>
    </div>
  );
}
