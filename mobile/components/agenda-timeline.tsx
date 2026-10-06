import { Text, View } from "react-native";
import { type AgendaData, timeLabel } from "../lib/agenda";
import { Badge, Card, EmptyState, colors, styles } from "./ui";

const status = {
  SCHEDULED: { label: "Agendada", tone: "blue", background: "#eff6ff" },
  CONFIRMED: { label: "Confirmada", tone: "green", background: "#ecfdf5" },
  COMPLETED: { label: "Completada", tone: "neutral", background: "#fafafa" },
  NO_SHOW: { label: "No asistió", tone: "amber", background: "#fffbeb" },
} as const;

export function AgendaTimeline({ data }: { data: AgendaData }) {
  const events = [
    ...data.appointments.map(item => ({ ...item, kind: "appointment", title: item.customerName, appointment: item })),
    ...data.breaks.map(item => ({ ...item, kind: "break", title: item.label ? `Descanso · ${item.label}` : "Descanso", appointment: null })),
    ...data.blocks.map(item => ({ ...item, kind: "block", title: `Bloqueado · ${item.label}`, appointment: null })),
  ].sort((a, b) => a.startMinute - b.startMinute);
  const open = data.businessHour && !data.businessHour.isClosed ? data.businessHour : null;
  const start = Math.floor(Math.min(open?.opensMinute ?? events[0]?.startMinute ?? 480, ...events.map(item => item.startMinute)) / 60) * 60;
  const end = Math.max(open?.closesMinute ?? start + 60, ...events.map(item => item.endMinute));
  if (!events.length && !open) return <EmptyState title="Sin horario de atención" description="No tienes reservas para este día." />;
  return <View style={{ gap: 12 }}>
    {!data.appointments.length && <Text style={styles.muted}>No tienes reservas para este día.</Text>}
    {Array.from({ length: Math.max(1, Math.ceil((end - start) / 60)) }, (_, index) => start + index * 60).map(hour => {
      const available = data.availability.some(item => item.startMinute < hour + 60 && item.endMinute > hour);
      return <View key={hour} style={{ flexDirection: "row", gap: 10 }}>
        <Text style={[styles.muted, { width: 44, paddingTop: 12, fontSize: 12 }]}>{timeLabel(hour)}</Text>
        <View style={{ flex: 1, minHeight: 52, gap: 8, borderLeftWidth: 1, borderColor: colors.border, paddingLeft: 10, paddingVertical: 4, backgroundColor: available ? colors.background : "#fafafa" }}>
          {events.filter(item => item.startMinute >= hour && item.startMinute < hour + 60).map(item => {
            const appearance = item.appointment ? status[item.appointment.status] : null;
            return <Card key={`${item.kind}-${item.id}`} style={{ padding: 12, backgroundColor: appearance?.background ?? (item.kind === "block" ? "#f1f5f9" : "#fafafa") }}>
              <Text style={styles.label}>{item.title}</Text>
              {item.appointment && <Text style={styles.muted}>{item.appointment.serviceName}</Text>}
              <Text style={styles.muted}>{timeLabel(item.startMinute)}–{timeLabel(item.endMinute)}</Text>
              {appearance && <Badge tone={appearance.tone}>{appearance.label}</Badge>}
            </Card>;
          })}
        </View>
      </View>;
    })}
  </View>;
}
