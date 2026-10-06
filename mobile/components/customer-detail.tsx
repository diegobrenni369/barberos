import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { appointmentAppearance } from "./agenda-timeline";
import { Badge, Button, Card, Separator, styles } from "./ui";
import { ContactActions } from "./contact-actions";

type Appointment = { id: string; startsAt: string; service: string; barber: string; status: keyof typeof appointmentAppearance };
type Profile = {
  customer: { id: string; name: string; phone: string | null; email: string | null };
  timezone: string; currency: string;
  summary: { visits: number; spent: string; average: string; lastVisit: string | null };
  next: Appointment | null;
  history: (Appointment & { total: string | null; currency: string })[];
};

export function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { get } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void get<Profile>(`/api/mobile/customers/${encodeURIComponent(id)}`)
      .then(result => { if (active) setProfile(result); })
      .catch(failure => { if (active) setError(failure instanceof ApiError && failure.status === 404 ? "Cliente no encontrado." : "No se pudo cargar el cliente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, get, retry]);
  const date = (value: string) => new Intl.DateTimeFormat("es-CL", { timeZone: profile?.timezone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const time = (value: string) => new Intl.DateTimeFormat("es-CL", { timeZone: profile?.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const money = (value: string, currency = profile?.currency) => new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(Number(value));
  function appointment(item: Appointment, amount?: string) {
    const appearance = appointmentAppearance[item.status];
    return <View style={{ gap: 3 }}><Text style={[styles.label, { fontWeight: "600" }]}>{item.service}</Text><Text style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>{date(item.startsAt)} · {time(item.startsAt)}</Text><Text style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>{item.barber}</Text><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 3 }}><Badge tone={appearance.tone}>{appearance.label}</Badge>{amount !== undefined && <Text style={[styles.label, { fontVariant: ["tabular-nums"], marginLeft: "auto" }]}>{amount}</Text>}</View></View>;
  }
  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.screen}>
      <SheetHeader title="Cliente" onClose={onClose} />
      <ScrollView contentContainerStyle={[styles.content, { padding: 16, gap: 18 }]}>
        {loading ? <ActivityIndicator accessibilityLabel="Cargando cliente" /> : error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></> : profile && <>
          <View style={{ gap: 6 }}><Text style={styles.title}>{profile.customer.name}</Text><Text style={styles.muted}>{profile.customer.phone ?? "Sin teléfono"}</Text>{!!profile.customer.email && <Text style={styles.muted}>{profile.customer.email}</Text>}</View>
          <ContactActions phone={profile.customer.phone} />
          <Card><Text style={styles.subtitle}>Próxima cita</Text>{profile.next ? appointment(profile.next) : <Text style={styles.muted}>Sin próximas citas.</Text>}</Card>
          <Card><Text style={styles.subtitle}>Resumen</Text><View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, justifyContent: "space-between" }}>{[
            ["Visitas completadas", String(profile.summary.visits)], ["Gastado", money(profile.summary.spent)],
            ["Ticket promedio", money(profile.summary.average)], ["Última visita", profile.summary.lastVisit ? date(profile.summary.lastVisit) : "Sin visitas"],
          ].map(([label, value]) => <View key={label} style={{ width: "48%", gap: 4 }}><Text style={[styles.muted, { fontSize: 11, lineHeight: 16 }]}>{label}</Text><Text style={[styles.label, { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] }]}>{value}</Text></View>)}</View></Card>
          <View style={{ gap: 8 }}><Text style={styles.subtitle}>Historial reciente</Text><Text style={[styles.muted, { fontSize: 12 }]}>Últimas 10 citas finalizadas.</Text>{!profile.history.length && <Text style={styles.muted}>Sin historial de citas finalizadas.</Text>}{profile.history.map(item => <View key={item.id} style={{ gap: 8 }}>{appointment(item, item.total !== null ? money(item.total, item.currency) : undefined)}<Separator /></View>)}</View>
        </>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
import { SheetHeader } from "./sheet-header";
