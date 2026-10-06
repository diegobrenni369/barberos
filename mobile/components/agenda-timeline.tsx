import { Pressable, Text, View } from "react-native";
import { type AgendaData, type MobileAppointment, timeLabel } from "../lib/agenda";
import { EmptyState, colors, styles } from "./ui";
import { CurrentTimeLine } from "./current-time-line";

// Presentation scale only: every event uses the same minutes-to-height ratio.
const PIXELS_PER_MINUTE = 2;
// Match web: inset the visible surface, not the temporal event bounds.
const EVENT_INSET = 4;
const borders = { SCHEDULED: "#d5e6fc", CONFIRMED: "#c7eddd", COMPLETED: "#e5e5e5", NO_SHOW: "#f5e6bd", CANCELLED: "#f5d7d7" };
const indicators = { SCHEDULED: "#3b82f6", CONFIRMED: "#10b981", COMPLETED: "#94a3b8", NO_SHOW: "#d97706", CANCELLED: "#ef4444" };

export const appointmentAppearance = {
  SCHEDULED: { label: "Agendada", tone: "blue", background: "#eff6ff" },
  CONFIRMED: { label: "Confirmada", tone: "green", background: "#ecfdf5" },
  COMPLETED: { label: "Completada", tone: "neutral", background: "#fafafa" },
  NO_SHOW: { label: "No asistió", tone: "amber", background: "#fffbeb" },
  CANCELLED: { label: "Cancelada", tone: "red", background: "#fef2f2" },
} as const;

export function AgendaTimeline({ data, timezone, onAppointment, onGridLayout }: { data: AgendaData; timezone: string; onAppointment: (item: MobileAppointment) => void; onGridLayout?: (grid: { y: number; start: number; end: number; scale: number }) => void }) {
  const events = [
    ...data.appointments.map(item => ({ ...item, kind: "appointment", title: item.customerName, appointment: item })),
    ...data.breaks.map(item => ({ ...item, kind: "break", title: item.label ? `Descanso · ${item.label}` : "Descanso", appointment: null })),
    ...data.blocks.map(item => ({ ...item, kind: "block", title: `Bloqueado · ${item.label}`, appointment: null })),
  ].sort((a, b) => a.startMinute - b.startMinute);
  const open = data.businessHour && !data.businessHour.isClosed ? data.businessHour : null;
  const start = Math.floor(Math.min(open?.opensMinute ?? events[0]?.startMinute ?? 480, ...events.map(item => item.startMinute)) / 60) * 60;
  const end = Math.max(open?.closesMinute ?? start + 60, ...events.map(item => item.endMinute));
  const gridEnd = Math.ceil(end / 60) * 60;
  // Give overlapping items separate visual lanes without changing their times.
  const positioned: { event: typeof events[number]; lane: number; lanes: number }[] = [];
  let group: typeof positioned = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const finishGroup = () => { group.forEach(item => { item.lanes = laneEnds.length; }); positioned.push(...group); group = []; laneEnds = []; };
  for (const event of events) {
    if (event.startMinute >= groupEnd) finishGroup();
    let lane = laneEnds.findIndex(value => value <= event.startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = event.endMinute;
    group.push({ event, lane, lanes: 1 });
    groupEnd = Math.max(event.endMinute, group.length === 1 ? -1 : groupEnd);
  }
  finishGroup();
  if (!events.length && !open) return <EmptyState title="Sin horario de atención" description="No tienes reservas para este día." />;
  return <View style={{ gap: 8 }}>
    {!data.appointments.length && <Text style={styles.muted}>No tienes reservas para este día.</Text>}
    <View onLayout={event => onGridLayout?.({ y: event.nativeEvent.layout.y, start, end: gridEnd, scale: PIXELS_PER_MINUTE })} style={{ height: (gridEnd - start) * PIXELS_PER_MINUTE + 16, marginTop: 6 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 36, right: 0, top: 0, height: (gridEnd - start) * PIXELS_PER_MINUTE, backgroundColor: "#fafafa", borderLeftWidth: 1, borderColor: colors.border }}>
        {data.availability.map((interval, index) => <View key={index} style={{ position: "absolute", left: 0, right: 0, top: (Math.max(start, interval.startMinute) - start) * PIXELS_PER_MINUTE, height: Math.max(0, Math.min(gridEnd, interval.endMinute) - Math.max(start, interval.startMinute)) * PIXELS_PER_MINUTE, backgroundColor: colors.background }} />)}
      </View>
      {Array.from({ length: (gridEnd - start) / 60 + 1 }, (_, index) => start + index * 60).map(hour => <View pointerEvents="none" key={hour} style={{ position: "absolute", top: (hour - start) * PIXELS_PER_MINUTE, left: 0, right: 0 }}>
        <Text style={[styles.muted, { position: "absolute", top: -7, width: 34, fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] }]}>{timeLabel(hour)}</Text>
        <View style={{ marginLeft: 36, height: 1, backgroundColor: "#e2e2e2" }} />
      </View>)}
      <View style={{ position: "absolute", left: 36, right: 0, top: 0, bottom: 16 }}>
        {positioned.map(({ event: item, lane, lanes }) => {
          const appearance = item.appointment ? appointmentAppearance[item.appointment.status] : null;
          const border = item.appointment ? borders[item.appointment.status] : item.kind === "block" ? "#d5dee8" : colors.border;
          const height = (item.endMinute - item.startMinute) * PIXELS_PER_MINUTE;
          const compact = height < 84;
          const content = <View style={{ flex: 1, overflow: "hidden", paddingHorizontal: 8, paddingVertical: compact ? 2 : 5, borderRadius: 8, borderWidth: 1, borderColor: border, borderStyle: item.kind === "block" ? "dashed" : "solid", backgroundColor: appearance?.background ?? (item.kind === "block" ? "#f3f6f9" : "#f7f7f7") }}>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontWeight: item.appointment ? "600" : "500", color: item.appointment ? colors.text : "#525252" }}>{item.appointment?.serviceName ?? item.title}</Text>
            {item.appointment && height >= 44 && <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: "#525252" }}>{item.appointment.customerName}</Text>}
            {height >= 56 && <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 14, color: colors.muted, fontVariant: ["tabular-nums"] }}>{timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>}
            {appearance && !compact && <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: indicators[item.appointment!.status] }} /><Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 10, lineHeight: 14, color: "#525252" }}>{appearance.label}</Text></View>}
            {!item.appointment && height >= 32 && height < 56 && <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 14, color: colors.muted }}>{timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>}
          </View>;
          const placement = { position: "absolute" as const, top: (item.startMinute - start) * PIXELS_PER_MINUTE, height, left: `${lane / lanes * 100}%` as `${number}%`, width: `${100 / lanes}%` as `${number}%`, paddingHorizontal: EVENT_INSET, paddingVertical: EVENT_INSET };
          return item.appointment ? <Pressable key={`${item.kind}-${item.id}`} style={placement} accessibilityRole="button" accessibilityLabel={`${item.appointment.serviceName}, ${item.title}, ${timeLabel(item.startMinute)}–${timeLabel(item.endMinute)}, ${appearance?.label}. Ver detalle`} onPress={() => onAppointment(item.appointment!)}>{content}</Pressable> : <View key={`${item.kind}-${item.id}`} style={placement}>{content}</View>;
        })}
      </View>
      <CurrentTimeLine date={data.date} timezone={timezone} start={start} end={gridEnd} pixelsPerMinute={PIXELS_PER_MINUTE} />
    </View>
  </View>;
}
