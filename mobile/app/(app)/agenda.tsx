import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { type AgendaData, type MobileAppointment, moveDate, todayIn } from "../../lib/agenda";
import { Avatar, Button, Card, EmptyState, colors, styles } from "../../components/ui";
import { Chevron } from "../../components/chevron";
import { AgendaTimeline } from "../../components/agenda-timeline";
import { AppointmentSheet } from "../../components/appointment-sheet";

export default function Agenda() {
  const { session, logout, get } = useAuth();
  const timezone = session?.barbershop.timezone ?? "America/Santiago";
  const [date, setDate] = useState(() => todayIn(timezone));
  const [barberId, setBarberId] = useState<string | null>(null);
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [appointment, setAppointment] = useState<MobileAppointment | null>(null);
  function statusChanged(id: string, status: "CONFIRMED" | "CANCELLED" | "NO_SHOW") {
    setData(current => current ? { ...current, appointments: current.appointments.flatMap(item => item.id !== id ? [item] : status === "CANCELLED" ? [] : [{ ...item, status, canChangeStatus: status === "CONFIRMED" }]) } : current);
    if (status === "CANCELLED") setAppointment(null);
    else setAppointment(current => current?.id === id ? { ...current, status, canChangeStatus: status === "CONFIRMED" } : current);
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void get<AgendaData>(`/api/mobile/agenda?date=${date}${barberId ? `&barberId=${encodeURIComponent(barberId)}` : ""}`).then(result => {
      if (active) setData(result);
    }).catch(failure => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 404 && barberId) {
        setBarberId(null); setData(null);
      } else setError("No se pudo cargar la agenda.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, barberId, retry, get]);
  async function signOut() {
    setBusy(true); setLogoutError("");
    try { await logout(); } catch { setLogoutError("No se pudo cerrar sesión. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  const selected = data?.barbers.find(item => item.id === (barberId ?? data.barberId));
  const changeDay = (next: string) => { if (!barberId && data?.barberId) setBarberId(data.barberId); setDate(next); };
  return <SafeAreaView style={styles.screen}>
    <View style={[styles.content, { gap: 10, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text style={[styles.title, { fontSize: 26 }]}>Agenda</Text><Text numberOfLines={1} style={[styles.muted, { flexShrink: 1, fontSize: 12 }]}>{session?.barbershop.name}</Text></View>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 2 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Día anterior" onPress={() => changeDay(moveDate(date, -1))} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: pressed ? colors.soft : colors.background })}><Chevron direction="left" /></Pressable>
          <Button title="Hoy" compact secondary onPress={() => changeDay(todayIn(timezone))} />
          <Pressable accessibilityRole="button" accessibilityLabel="Día siguiente" onPress={() => changeDay(moveDate(date, 1))} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: pressed ? colors.soft : colors.background })}><Chevron direction="right" /></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Seleccionar profesional" disabled={!data?.barbers.length} onPress={() => setPicker(true)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, backgroundColor: pressed ? colors.soft : colors.background })}><Text numberOfLines={1} style={[styles.label, { flex: 1 }]}>{selected?.name ?? "Profesional"}</Text><Chevron direction="down" size={20} /></Pressable>
      </View>
      <Text style={[styles.subtitle, { fontSize: 14, lineHeight: 20 }]}>{new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`))}</Text>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: 12, paddingHorizontal: 8, paddingBottom: 12 }]}>
      {loading ? <View accessibilityLabel="Cargando agenda" style={{ padding: 32 }}><ActivityIndicator /><Text style={styles.muted}>Cargando agenda…</Text></View> : error ? <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></Card> : data && (data.barberId ? <AgendaTimeline data={data} onAppointment={setAppointment} /> : <EmptyState title="Sin profesionales activos" />)}
    </ScrollView>
    <View style={{ paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      {!!logoutError && <Text accessibilityRole="alert" style={styles.error}>{logoutError}</Text>}
      <Button title="Cerrar sesión" variant="ghost" loading={busy} onPress={() => void signOut()} />
    </View>
    {appointment && <AppointmentSheet key={appointment.id} appointment={appointment} timezone={timezone} onClose={() => setAppointment(null)} onChanged={statusChanged} onRefresh={() => setRetry(value => value + 1)} />}
    <Modal visible={picker} animationType="slide" onRequestClose={() => setPicker(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profesional</Text>
        {data?.barbers.map(barber => <Pressable key={barber.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === barber.id }} onPress={() => { setBarberId(barber.id); setPicker(false); }} style={[styles.card, { flexDirection: "row", alignItems: "center" }]}><Avatar name={barber.name} /><Text style={[styles.label, { flex: 1 }]}>{barber.name}</Text>{selected?.id === barber.id && <Text>✓</Text>}</Pressable>)}
        <Button title="Cerrar" secondary onPress={() => setPicker(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
