import { ActionSurface, PickerSurface, SelectionOption } from "../../components/creation-controls";
import { useAgendaScroll } from "../../lib/use-agenda-scroll";
import { AgendaWeek } from "../../components/agenda-week";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { useSelectedBarber } from "../../lib/selected-barber";
import { ApiError } from "../../lib/api";
import { type AgendaData, type MobileAppointment, todayIn } from "../../lib/agenda";
import { Button, Card, EmptyState, colors, styles } from "../../components/ui";
import { Chevron } from "../../components/chevron";
import { AgendaTimeline } from "../../components/agenda-timeline";
import { AppointmentSheet } from "../../components/appointment-sheet";
import { AgendaCreate, type CreateMode } from "../../components/agenda-create";

export default function Agenda() {
  const { session, get } = useAuth();
  const timezone = session?.barbershop.timezone ?? "America/Santiago";
  const [date, setDate] = useState(() => todayIn(timezone));
  const { barberId, setBarberId } = useSelectedBarber();
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [picker, setPicker] = useState(false);
  const [appointment, setAppointment] = useState<MobileAppointment | null>(null);
  const [createMenu, setCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [notice, setNotice] = useState("");
  const agendaScroll = useAgendaScroll(date, timezone, data?.barberId ?? barberId, !loading && !error && data?.date === date);
  function checkoutDone(id: string) {
    const update = (item: MobileAppointment): MobileAppointment => item.id === id ? { ...item, status: "COMPLETED", canCharge: false, canChangeStatus: false, paymentLabel: "Pagada" } : item;
    setData(current => current ? { ...current, appointments: current.appointments.map(update) } : current);
    setAppointment(current => current ? update(current) : current);
    setRetry(value => value + 1);
  }
  function statusChanged(id: string, status: "CONFIRMED" | "CANCELLED" | "NO_SHOW") {
    setData(current => current ? { ...current, appointments: current.appointments.flatMap(item => item.id !== id ? [item] : status === "CANCELLED" ? [] : [{ ...item, status, canChangeStatus: status === "CONFIRMED", canCharge: status === "CONFIRMED" && item.canCharge }]) } : current);
    if (status === "CANCELLED") setAppointment(null);
    else setAppointment(current => current?.id === id ? { ...current, status, canChangeStatus: status === "CONFIRMED", canCharge: status === "CONFIRMED" && current.canCharge } : current);
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void get<AgendaData>(`/api/mobile/agenda?date=${date}${barberId ? `&barberId=${encodeURIComponent(barberId)}` : ""}`).then(result => {
      if (active) {
        setData(result); if (!barberId) setBarberId(result.barberId);
        setAppointment(current => {
          const refreshed = current && result.appointments.find(item => item.id === current.id);
          return current && refreshed ? { ...current, paymentLabel: refreshed.paymentLabel, payment: refreshed.payment } : current;
        });
      }
    }).catch(failure => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 404 && barberId) {
        setBarberId(null); setData(null);
      } else setError("No se pudo cargar la agenda.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, barberId, retry, get, setBarberId]);
  const selected = data?.barbers.find(item => item.id === (barberId ?? data.barberId));
  const changeDay = (next: string) => { if (!barberId && data?.barberId) setBarberId(data.barberId); if (next !== date) agendaScroll.requestScroll("restore"); setDate(next); };
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <View style={[styles.content, { gap: 4, padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ minHeight: 36, paddingRight: 52 }}><Text style={styles.title}>Agenda</Text><Pressable accessibilityRole="button" accessibilityLabel="Crear cita o bloqueo" disabled={!selected || loading} onPress={() => setCreateMenu(true)} style={{ position: "absolute", right: 0, top: -4, width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.soft, opacity: !selected || loading ? 0.5 : 1 }}><Text style={{ fontSize: 26, color: colors.text }}>+</Text></Pressable></View>
      <AgendaWeek date={date} timezone={timezone} onChange={changeDay} onToday={() => { changeDay(todayIn(timezone)); agendaScroll.requestScroll("now"); }} professional={session?.role === "BARBER" ? <View style={{ minHeight: 44, maxWidth: "100%", justifyContent: "center" }}><Text numberOfLines={1} style={[styles.label, { fontSize: 12 }]}>{session.barberName}</Text></View> : <Pressable accessibilityRole="button" accessibilityLabel="Seleccionar profesional" disabled={!data?.barbers.length} onPress={() => setPicker(true)} style={({ pressed }) => ({ alignSelf: "flex-end", maxWidth: "100%", minHeight: 44, paddingRight: 0, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, backgroundColor: pressed ? colors.soft : colors.background })}><Text numberOfLines={1} style={[styles.label, { flexShrink: 1, fontSize: 12 }]}>{selected?.name ?? "Profesional"}</Text><Chevron direction="down" size={18} /></Pressable>} />
    </View>
    <ScrollView ref={agendaScroll.ref} onLayout={event => agendaScroll.setViewport(event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => agendaScroll.setHeight(height)} onScroll={event => agendaScroll.onScroll(event.nativeEvent.contentOffset.y)} scrollEventThrottle={16} onScrollBeginDrag={agendaScroll.onDrag} style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12 }]}>
      {!!notice && <Text accessibilityRole="alert" style={styles.muted}>{notice}</Text>}
      {loading ? <View accessibilityLabel="Cargando agenda" style={{ padding: 32 }}><ActivityIndicator /><Text style={styles.muted}>Cargando agenda…</Text></View> : error ? <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></Card> : data && (data.barberId ? <View key={`${data.date}:${data.barberId}`} onLayout={event => agendaScroll.onOrigin(event.nativeEvent.layout.y)}><AgendaTimeline timezone={timezone} data={data} onAppointment={setAppointment} onGridLayout={agendaScroll.onGrid} /></View> : <EmptyState title="Sin profesionales activos" />)}
    </ScrollView>
    {appointment && <AppointmentSheet key={appointment.id} appointment={appointment} timezone={timezone} onClose={() => setAppointment(null)} onChanged={statusChanged} onRefresh={() => setRetry(value => value + 1)} onPaid={checkoutDone} />}
    {createMode && selected && <AgendaCreate mode={createMode} barberId={selected.id} barberName={selected.name} initialDate={date} onClose={() => setCreateMode(null)} onCreated={createdDate => { setNotice(createMode === "appointment" ? "Cita creada." : "Bloqueo guardado."); setBarberId(selected.id); setDate(createdDate); setCreateMode(null); setRetry(value => value + 1); }} />}
    {createMenu && <ActionSurface onClose={() => setCreateMenu(false)}>
      <View>{([{ mode: "appointment", title: "Nueva cita" }, { mode: "block", title: "Bloquear horario" }, { mode: "day", title: "Bloquear día" }] as const).map(item => <SelectionOption key={item.mode} title={item.title} onPress={() => { setCreateMenu(false); setCreateMode(item.mode); setNotice(""); }} />)}</View>
    </ActionSurface>}
    {picker && session?.role === "OWNER" && <PickerSurface title="Profesional" onClose={() => setPicker(false)}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>{data?.barbers.map(barber => <SelectionOption key={barber.id} title={barber.name} selected={selected?.id === barber.id} onPress={() => { setBarberId(barber.id); setPicker(false); }} />)}</ScrollView>
    </PickerSurface>}
  </SafeAreaView>;
}
