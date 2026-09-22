import { businessDays, formatBusinessTime, type StoredBusinessHour } from "@/lib/business-hours";

type Interval = { dayOfWeek: string; startMinute: number; endMinute: number };
type Break = Interval & { label: string | null };

// Group adjacent days only; compare every interval and label, not just totals.
function groupDays(entries: { day: string; signature: string; text: string }[]) {
  const groups: { first: string; last: string; signature: string; text: string }[] = [];
  for (const entry of entries) {
    const previous = groups.at(-1);
    if (previous && previous.signature === entry.signature) previous.last = entry.day;
    else groups.push({ first: entry.day, last: entry.day, signature: entry.signature, text: entry.text });
  }
  return groups;
}

export function BarberHoursSummary({ availability, breaks, businessHours }: {
  availability: Interval[];
  breaks: Break[];
  businessHours: StoredBusinessHour[];
}) {
  const custom = availability.length > 0;
  const weekly = businessDays.map((day) => {
    const business = businessHours.find((item) => item.dayOfWeek === day.value);
    const intervals = custom
      ? availability.filter((item) => item.dayOfWeek === day.value).sort((a, b) => a.startMinute - b.startMinute)
      : business && !business.isClosed ? [{ startMinute: business.opensMinute, endMinute: business.closesMinute }] : [];
    const text = intervals.length
      ? intervals.map((item) => `${formatBusinessTime(item.startMinute)}–${formatBusinessTime(item.endMinute)}`).join(", ")
      : custom ? "No trabaja" : "Cerrado";
    return { day: day.label.slice(0, 3), signature: text, text };
  });
  const rest = businessDays.map((day) => {
    const items = breaks.filter((item) => item.dayOfWeek === day.value).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || (a.label ?? "").localeCompare(b.label ?? ""));
    const text = items.map((item) => `${formatBusinessTime(item.startMinute)}–${formatBusinessTime(item.endMinute)}${item.label ? ` · ${item.label}` : ""}`).join(", ");
    return { day: day.label.slice(0, 3), signature: JSON.stringify(items.map(({ startMinute, endMinute, label }) => ({ startMinute, endMinute, label }))), text };
  });
  return <div className="space-y-4">
    <SummaryRows groups={groupDays(weekly)} />
    {breaks.length > 0 ? <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Descansos</h3><SummaryRows groups={groupDays(rest).filter((group) => group.text)} /></div> : <p className="text-sm text-muted-foreground">Sin descansos recurrentes</p>}
  </div>;
}

function SummaryRows({ groups }: { groups: ReturnType<typeof groupDays> }) {
  return <dl className="space-y-2 text-sm">{groups.map((group) => <div key={group.first} className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
    <dt className="text-muted-foreground">{group.first === group.last ? group.first : `${group.first}–${group.last}`}</dt>
    <dd className="tabular-nums">{group.text}</dd>
  </div>)}</dl>;
}
