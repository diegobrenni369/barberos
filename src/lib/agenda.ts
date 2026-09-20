export const AGENDA_START_HOUR = 8;
export const AGENDA_END_HOUR = 20;
export const AGENDA_SLOT_MINUTES = 30;
export const AGENDA_PIXELS_PER_MINUTE = 1.6;
export const AGENDA_TOP_GUTTER = 24;

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let result = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(result).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const correction = desired - represented;
    if (!correction) return result;
    result = new Date(result.getTime() + correction);
  }
  return result;
}

export function utcToZonedParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function dayRangeUtc(date: string, timeZone: string) {
  const start = zonedDateTimeToUtc(date, "00:00", timeZone);
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  return { start, end: zonedDateTimeToUtc(nextDate, "00:00", timeZone) };
}
