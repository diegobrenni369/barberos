export type Interval = { startMinute: number; endMinute: number };
export type MobileAppointment = Interval & { id: string; customerName: string; serviceName: string; status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED"; phone: string | null; notes: string | null; price: string; currency: string; barberName: string; startsAt: string; endsAt: string; canChangeStatus: boolean; canCharge: boolean; paymentLabel: string | null; payment?: { methods: string; amount: string; currency: string } | null };
export type AgendaData = {
  date: string; today: string; barberId: string | null;
  barbers: { id: string; name: string }[];
  businessHour: { isClosed: boolean; opensMinute: number; closesMinute: number } | null;
  availability: Interval[];
  appointments: MobileAppointment[];
  breaks: (Interval & { id: string; label: string | null })[];
  blocks: (Interval & { id: string; label: string })[];
};
export function moveDate(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function todayIn(timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const timeLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
