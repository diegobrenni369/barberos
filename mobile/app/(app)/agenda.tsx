import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { type AgendaData, moveDate, todayIn } from "../../lib/agenda";
import { Avatar, Button, Card, EmptyState, styles } from "../../components/ui";
import { AgendaTimeline } from "../../components/agenda-timeline";

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
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.muted}>{session?.barbershop.name}</Text><Text style={styles.title}>Agenda</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Button title="‹" secondary onPress={() => changeDay(moveDate(date, -1))} />
        <Button title="Hoy" secondary onPress={() => changeDay(todayIn(timezone))} />
        <Button title="›" secondary onPress={() => changeDay(moveDate(date, 1))} />
        <Pressable accessibilityRole="button" accessibilityLabel="Seleccionar profesional" disabled={!data?.barbers.length} onPress={() => setPicker(true)} style={[styles.button, styles.secondary, { flexGrow: 1, flexShrink: 1, maxWidth: "100%" }]}><Text numberOfLines={1} style={styles.label}>{selected?.name ?? "Profesional"} ▾</Text></Pressable>
      </View>
      <Text style={styles.subtitle}>{new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`))}</Text>
      {loading ? <View accessibilityLabel="Cargando agenda" style={{ padding: 32 }}><ActivityIndicator /><Text style={styles.muted}>Cargando agenda…</Text></View> : error ? <Card><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></Card> : data && (data.barberId ? <AgendaTimeline data={data} /> : <EmptyState title="Sin profesionales activos" />)}
      {!!logoutError && <Text accessibilityRole="alert" style={styles.error}>{logoutError}</Text>}
      <Button title="Cerrar sesión" secondary loading={busy} onPress={() => void signOut()} />
    </ScrollView>
    <Modal visible={picker} animationType="slide" onRequestClose={() => setPicker(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profesional</Text>
        {data?.barbers.map(barber => <Pressable key={barber.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === barber.id }} onPress={() => { setBarberId(barber.id); setPicker(false); }} style={[styles.card, { flexDirection: "row", alignItems: "center" }]}><Avatar name={barber.name} /><Text style={[styles.label, { flex: 1 }]}>{barber.name}</Text>{selected?.id === barber.id && <Text>✓</Text>}</Pressable>)}
        <Button title="Cerrar" secondary onPress={() => setPicker(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
