"use client";

import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";
import { UNAVAILABLE_PATTERN } from "./availability-layer";
export type BarberBreakData = { id: string; barberId: string; startMinute: number; endMinute: number; label: string };
export function BarberBreak({ item, gridStartMinute, gridEndMinute }: { item: BarberBreakData; gridStartMinute: number; gridEndMinute: number }) {
  const start = Math.max(item.startMinute, gridStartMinute);
  const end = Math.min(item.endMinute, gridEndMinute);
  if (start >= end) return null;
  return <div className="pointer-events-none absolute inset-x-0 z-[6] overflow-hidden bg-muted/35 px-2 py-1 text-[11px] text-muted-foreground" style={{ top: AGENDA_TOP_GUTTER + (start - gridStartMinute) * AGENDA_PIXELS_PER_MINUTE, height: (end - start) * AGENDA_PIXELS_PER_MINUTE, backgroundImage: UNAVAILABLE_PATTERN }}>{item.label || "Descanso"}</div>;
}
