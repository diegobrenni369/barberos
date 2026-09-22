export const businessDays = [
  { value: "MONDAY", label: "Lunes" },
  { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" },
  { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
] as const;

export type StoredBusinessHour = {
  dayOfWeek: string;
  opensMinute: number;
  closesMinute: number;
  isClosed: boolean;
};

export function formatBusinessTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function businessHoursSummary(hours: StoredBusinessHour[]) {
  return businessDays.map((day) => {
    const item = hours.find((value) => value.dayOfWeek === day.value);
    const schedule = !item || item.isClosed
      ? "Cerrado"
      : `${formatBusinessTime(item.opensMinute)}–${formatBusinessTime(item.closesMinute)}`;
    return `${day.label}: ${schedule}`;
  });
}
