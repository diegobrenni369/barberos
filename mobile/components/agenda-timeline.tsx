import { semanticColors } from "../lib/semantic-colors";
import { Pressable, Text, View } from "react-native";
import { type AgendaData, type MobileAppointment, type MobileBlock, timeLabel } from "../lib/agenda";
import { EmptyState, colors, styles } from "./ui";
import { CurrentTimeLine } from "./current-time-line";
import { UnavailablePattern } from "./unavailable-pattern";

// Presentation scale only: every event uses the same minutes-to-height ratio.
const PIXELS_PER_MINUTE = 2;
// Match web: inset the visible surface, not the temporal event bounds.
const EVENT_INSET = 4;
const borders = { SCHEDULED: semanticColors.blue.border, CONFIRMED: semanticColors.green.border, COMPLETED: semanticColors.green.border, NO_SHOW: semanticColors.amber.border, CANCELLED: semanticColors.red.border };
const indicators = { SCHEDULED: semanticColors.blue.indicator, CONFIRMED: semanticColors.green.indicator, COMPLETED: semanticColors.green.indicator, NO_SHOW: semanticColors.amber.indicator, CANCELLED: semanticColors.red.indicator };

export const appointmentAppearance = {
  SCHEDULED: { label: "Agendada", tone: "blue", background: semanticColors.blue.background },
  CONFIRMED: { label: "Confirmada", tone: "green", background: semanticColors.green.background },
  COMPLETED: { label: "Completada", tone: "green", background: semanticColors.green.background },
  NO_SHOW: { label: "No asistió", tone: "amber", background: semanticColors.amber.background },
  CANCELLED: { label: "Cancelada", tone: "red", background: semanticColors.red.background },
} as const;

export function AgendaTimeline({ data, timezone, onAppointment, onBlock, onGridLayout }: { data: AgendaData; timezone: string; onAppointment: (item: MobileAppointment) => void; onBlock: (item: MobileBlock) => void; onGridLayout?: (grid: { y: number; start: number; end: number; scale: number }) => void }) {
  const events = [
    ...data.appointments.map(item => ({ ...item, kind: "appointment", title: item.customerName, appointment: item })),
    ...data.blocks.map(item => ({ ...item, kind: "block", title: `Bloqueado · ${item.label}`, appointment: null })),
  ].sort((a, b) => a.startMinute - b.startMinute);
  const open = data.businessHour && !data.businessHour.isClosed ? data.businessHour : null;
  const intervals = [...events, ...data.breaks];
  const start = Math.floor(Math.min(open?.opensMinute ?? intervals[0]?.startMinute ?? 480, ...intervals.map(item => item.startMinute)) / 60) * 60;
  const end = Math.max(open?.closesMinute ?? start + 60, ...intervals.map(item => item.endMinute));
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
  if (!intervals.length && !open) return <EmptyState title="Sin horario de atención" description="Sin reservas" />;
  return <View style={{ gap: 8 }}>
    {!data.appointments.length && <Text style={styles.emptyMessage}>Sin reservas</Text>}
    <View onLayout={event => onGridLayout?.({ y: event.nativeEvent.layout.y, start, end: gridEnd, scale: PIXELS_PER_MINUTE })} style={{ height: (gridEnd - start) * PIXELS_PER_MINUTE + 16, marginTop: 6 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 36, right: 0, top: 0, height: (gridEnd - start) * PIXELS_PER_MINUTE, backgroundColor: "#fafafa", borderLeftWidth: 1, borderColor: colors.border }}>
        <UnavailablePattern height={(gridEnd - start) * PIXELS_PER_MINUTE} />
        {data.availability.map((interval, index) => <View key={index} style={{ position: "absolute", left: 0, right: 0, top: (Math.max(start, interval.startMinute) - start) * PIXELS_PER_MINUTE, height: Math.max(0, Math.min(gridEnd, interval.endMinute) - Math.max(start, interval.startMinute)) * PIXELS_PER_MINUTE, backgroundColor: colors.background }} />)}
      </View>
      {data.breaks.map(item => <View key={`break-${item.id}`} pointerEvents="none" style={{ position: "absolute", left: 36, right: 0, top: (item.startMinute - start) * PIXELS_PER_MINUTE, height: (item.endMinute - item.startMinute) * PIXELS_PER_MINUTE, overflow: "hidden" }}>
        <UnavailablePattern height={(item.endMinute - item.startMinute) * PIXELS_PER_MINUTE} />
        <Text numberOfLines={1} style={{ paddingHorizontal: 8, paddingTop: 5, fontSize: 11, color: colors.muted }}>{item.label || "Descanso"} · {timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>
      </View>)}
      {/* Keep the hour-column divider above unavailable-area backgrounds. */}
      <View pointerEvents="none" style={{ position: "absolute", left: 36, top: 0, width: 1, height: (gridEnd - start) * PIXELS_PER_MINUTE, backgroundColor: colors.border }} />
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
          const content = <View style={{ flex: 1, overflow: "hidden", paddingHorizontal: 8, paddingVertical: compact ? 2 : 5, borderRadius: 8, borderWidth: 1, borderColor: border, backgroundColor: appearance?.background ?? "#f3f6f9" }}>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontWeight: item.appointment ? "600" : "500", color: item.appointment ? colors.text : "#525252" }}>{item.appointment?.serviceName ?? item.title}</Text>
            {item.appointment && height >= 44 && <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: "#525252" }}>{item.appointment.customerName}</Text>}
            {height >= 56 && <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 14, color: colors.muted, fontVariant: ["tabular-nums"] }}>{timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>}
            {appearance && !compact && <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: indicators[item.appointment!.status] }} /><Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 10, lineHeight: 14, color: "#525252" }}>{appearance.label}</Text></View>}
            {!item.appointment && height >= 32 && height < 56 && <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 14, color: colors.muted }}>{timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>}
          </View>;
          const placement = { position: "absolute" as const, top: (item.startMinute - start) * PIXELS_PER_MINUTE, height, left: `${lane / lanes * 100}%` as `${number}%`, width: `${100 / lanes}%` as `${number}%`, paddingHorizontal: EVENT_INSET, paddingVertical: EVENT_INSET };
          return item.appointment ? <Pressable key={`${item.kind}-${item.id}`} style={placement} accessibilityRole="button" accessibilityLabel={`${item.appointment.serviceName}, ${item.title}, ${timeLabel(item.startMinute)}–${timeLabel(item.endMinute)}, ${appearance?.label}. Ver detalle`} onPress={() => onAppointment(item.appointment!)}>{content}</Pressable> : <Pressable key={`${item.kind}-${item.id}`} style={placement} accessibilityRole="button" accessibilityLabel={`${item.title}. Ver bloqueo`} onPress={() => { const block = data.blocks.find(block => block.id === item.id); if (block) onBlock(block); }}>{content}</Pressable>;
        })}
      </View>
      <CurrentTimeLine date={data.date} timezone={timezone} start={start} end={gridEnd} pixelsPerMinute={PIXELS_PER_MINUTE} />
    </View>
  </View>;
}
