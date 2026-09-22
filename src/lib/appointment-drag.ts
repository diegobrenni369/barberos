import { AGENDA_SLOT_MINUTES } from "@/lib/agenda";

export function snapAgendaMinute(minute: number, gridStart: number) {
  return gridStart + Math.floor((minute - gridStart) / AGENDA_SLOT_MINUTES) * AGENDA_SLOT_MINUTES;
}

export function dragTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
