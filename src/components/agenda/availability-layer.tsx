import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";

export type AvailabilityInterval = { startMinute: number; endMinute: number };

export function AvailabilityLayer({ intervals, start, end }: { intervals: AvailabilityInterval[]; start: number; end: number }) {
  const normalized = intervals.map((item) => ({ startMinute: Math.max(start, item.startMinute), endMinute: Math.min(end, item.endMinute) })).filter((item) => item.startMinute < item.endMinute).sort((a, b) => a.startMinute - b.startMinute);
  const unavailable: AvailabilityInterval[] = []; let cursor = start;
  for (const interval of normalized) { if (interval.startMinute > cursor) unavailable.push({ startMinute: cursor, endMinute: interval.startMinute }); cursor = Math.max(cursor, interval.endMinute); }
  if (cursor < end) unavailable.push({ startMinute: cursor, endMinute: end });
  return <div className="pointer-events-none absolute inset-0 z-[1]">{unavailable.map((item, index) => <div key={index} className="absolute inset-x-0 bg-muted/35" style={{ top: AGENDA_TOP_GUTTER + (item.startMinute - start) * AGENDA_PIXELS_PER_MINUTE, height: (item.endMinute - item.startMinute) * AGENDA_PIXELS_PER_MINUTE, backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 7px, color-mix(in oklab, var(--muted-foreground) 5%, transparent) 7px, color-mix(in oklab, var(--muted-foreground) 5%, transparent) 8px)" }} />)}</div>;
}

export function isSlotAvailable(intervals: AvailabilityInterval[], startMinute: number, duration = 30) { return intervals.some((item) => startMinute >= item.startMinute && startMinute + duration <= item.endMinute); }
