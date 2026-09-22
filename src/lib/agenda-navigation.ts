// Calendar values represent civil dates, not UTC instants.
export function calendarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(12, 0, 0, 0);
  return value;
}

export function civilDate(value: Date) {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function agendaHref(query: string, date: string, changes: Record<string, string | null> = {}) {
  const params = new URLSearchParams(query);
  params.set("date", date);
  params.delete("error");
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return `/agenda?${params.toString()}`;
}
