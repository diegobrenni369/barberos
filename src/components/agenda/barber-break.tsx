"use client";

import { Coffee } from "lucide-react";
import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";
export type BarberBreakData = { id: string; barberId: string; startMinute: number; endMinute: number; label: string };
export function BarberBreak({ item, gridStartMinute, gridEndMinute }: { item: BarberBreakData; gridStartMinute: number; gridEndMinute: number }) { const start = Math.max(item.startMinute, gridStartMinute); const end = Math.min(item.endMinute, gridEndMinute); if (start >= end) return null; return <div className="pointer-events-none absolute z-[6] overflow-hidden rounded-md border border-muted-foreground/15 bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground" style={{ left: 4, right: 4, top: AGENDA_TOP_GUTTER + (start - gridStartMinute) * AGENDA_PIXELS_PER_MINUTE, height: (end - start) * AGENDA_PIXELS_PER_MINUTE }}><div className="flex items-center gap-1 font-medium"><Coffee className="size-3" />{item.label}</div></div>; }
