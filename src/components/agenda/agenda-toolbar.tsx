"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { agendaHref } from "@/lib/agenda-navigation";

function shift(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function AgendaToolbar({ date, today, onNew, panelControls }: {
  date: string;
  today: string;
  onNew?: () => void;
  panelControls?: ReactNode;
}) {
  const params = useSearchParams();
  const href = (value: string) => agendaHref(params.toString(), value);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button nativeButton={false} variant="outline" size="icon" render={<Link href={href(shift(date, -1))} scroll={false} />} aria-label="Día anterior"><ChevronLeft /></Button>
        <Button nativeButton={false} variant="outline" render={<Link href={href(today)} scroll={false} />}>Hoy</Button>
        <Button nativeButton={false} variant="outline" size="icon" render={<Link href={href(shift(date, 1))} scroll={false} />} aria-label="Día siguiente"><ChevronRight /></Button>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onNew} disabled={!onNew}><Plus />Nueva reserva</Button>
        {panelControls}
      </div>
    </div>
  );
}
