import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { useSelectedBarber } from "../../lib/selected-barber";
import { todayIn } from "../../lib/agenda";
import { ApiError } from "../../lib/api";
import { CompactSelect, DateControl, readableDate } from "../../components/creation-controls";
import { Badge, Button, Card, Separator, styles } from "../../components/ui";
import { Check } from "../../components/chevron";

type Report = {
  barber: { id: string; name: string }; timezone: string; currency: string; from: string; to: string;
  summary: { sales: string; generated: string; pending: string; paid: string };
  rows: { id: string; date: string; service: string; customer: string; base: string; rate: string; amount: string; currency: string; paid: boolean }[];
};
const periods = [{ id: "week", title: "Esta semana" }, { id: "previous-week", title: "Semana anterior" }, { id: "fortnight", title: "Quincena actual" }, { id: "month", title: "Este mes" }, { id: "custom", title: "Personalizado" }];

export default function Commissions() {
  const { get, session } = useAuth();
  const { barberId } = useSelectedBarber();
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState(() => todayIn(session?.barbershop.timezone ?? "America/Santiago"));
  const [to, setTo] = useState(from);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const invalidRange = period === "custom" && from > to;
  useFocusEffect(useCallback(() => {
    let active = true;
    setReport(null); setError("");
    if (!barberId || invalidRange) { setLoading(false); return; }
    setLoading(true);
    const custom = period === "custom" ? `&from=${from}&to=${to}` : "";
    void get<Report>(`/api/mobile/commissions?barberId=${encodeURIComponent(barberId)}&period=${period}${custom}`)
      .then(result => { if (active) setReport(result); })
      .catch(failure => { if (active) setError(failure instanceof ApiError && failure.status === 404 ? "El profesional ya no está disponible. Selecciona otro en Agenda." : "No se pudieron cargar las comisiones."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [barberId, from, to, period, invalidRange, get, retry]));
  const money = (value: string, currency: string) => new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(Number(value));
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <FlatList data={report?.rows ?? []} keyExtractor={item => item.id} contentContainerStyle={[styles.content, { padding: 16, gap: 12 }]}
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <View style={{ gap: 4 }}><Text style={styles.title}>Mis comisiones</Text>{report && <Text style={styles.muted}>{report.barber.name}</Text>}</View>
        <CompactSelect label="Período" value={period} options={periods} onChange={setPeriod} selectedIcon={<Check />} />
        {period === "custom" && <View style={{ gap: 10 }}><View style={{ gap: 4 }}><Text style={styles.label}>Desde</Text><DateControl date={from} onChange={setFrom} /></View><View style={{ gap: 4 }}><Text style={styles.label}>Hasta</Text><DateControl date={to} onChange={setTo} /></View></View>}
        {!barberId && <Text style={styles.muted}>Selecciona un profesional en Agenda para consultar sus comisiones.</Text>}
        {invalidRange && <Text accessibilityRole="alert" style={styles.error}>La fecha de inicio debe ser anterior o igual al término.</Text>}
        {loading && <ActivityIndicator accessibilityLabel="Cargando comisiones" />}
        {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setRetry(value => value + 1)} /></>}
        {report && <>
          <Text style={[styles.muted, { fontSize: 12 }]}>{readableDate(report.from)} – {readableDate(report.to)}</Text>
          <Card><Text style={styles.subtitle}>Resumen</Text><View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 }}>{[
            ["Ventas asociadas", report.summary.sales], ["Comisión generada", report.summary.generated], ["Comisión pendiente", report.summary.pending], ["Comisión pagada", report.summary.paid],
          ].map(([label, value]) => <View key={label} style={{ width: "48%", gap: 4 }}><Text style={[styles.muted, { fontSize: 11 }]}>{label}</Text><Text style={[styles.label, { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] }]}>{money(value, report.currency)}</Text></View>)}</View></Card>
          <Text style={[styles.muted, { fontSize: 11, lineHeight: 16 }]}>Ventas y pendientes por fecha de venta. Pagada por fecha de liquidación.</Text>
          <Text style={styles.subtitle}>Detalle</Text>
        </>}
      </View>}
      ListEmptyComponent={report ? <Text style={styles.muted}>No hay comisiones en este período.</Text> : null}
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => <View style={{ gap: 4 }}>
        <Text style={[styles.muted, { fontSize: 12 }]}>{new Intl.DateTimeFormat("es-CL", { timeZone: report?.timezone, day: "numeric", month: "short", year: "numeric" }).format(new Date(item.date))}</Text>
        <Text style={styles.label}>{item.service}</Text><Text style={styles.muted}>{item.customer}</Text>
        <Text style={[styles.muted, { fontSize: 12 }]}>Venta {money(item.base, item.currency)} · {item.rate}%</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", paddingTop: 3 }}><Text style={[styles.label, { fontWeight: "600", fontVariant: ["tabular-nums"] }]}>Comisión {money(item.amount, item.currency)}</Text><Badge tone={item.paid ? "green" : "amber"}>{item.paid ? "Pagada" : "Pendiente"}</Badge></View>
      </View>}
    />
  </SafeAreaView>;
}
