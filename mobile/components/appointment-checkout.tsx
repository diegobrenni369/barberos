import { useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { type MobileAppointment } from "../lib/agenda";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, Card, colors, styles } from "./ui";

const methods = [{ value: "CASH", label: "Efectivo" }, { value: "DEBIT_CARD", label: "Débito" }, { value: "CREDIT_CARD", label: "Crédito" }, { value: "TRANSFER", label: "Transferencia" }] as const;
type Method = typeof methods[number]["value"];
export function AppointmentCheckout({ appointment, onBack, onSuccess, onBusy }: { appointment: MobileAppointment; onBack: () => void; onSuccess: () => void; onBusy: (busy: boolean) => void }) {
  const { get } = useAuth();
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const total = new Intl.NumberFormat("es-CL", { style: "currency", currency: appointment.currency }).format(Number(appointment.price));
  async function submit() {
    if (!method || pending.current) return;
    pending.current = true; setBusy(true); onBusy(true); setError("");
    try {
      await get(`/api/mobile/appointments/${encodeURIComponent(appointment.id)}/checkout`, { method: "POST", body: { paymentMethod: method } });
      onSuccess();
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? "La cita no se puede cobrar o ya tiene una venta. Vuelve al detalle y actualiza la agenda." : "No se pudo confirmar el cobro. Puedes reintentar; no se generará una segunda venta.");
    } finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <View style={{ gap: 16 }}>
    <Text style={styles.subtitle}>Cobrar atención</Text>
    <Card><Text style={styles.subtitle}>{appointment.customerName}</Text><Text style={styles.muted}>{appointment.serviceName}</Text><Text style={styles.muted}>Total a pagar</Text><Text style={styles.title}>{total}</Text></Card>
    <Text style={styles.label}>Método de pago</Text>
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {methods.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: method === item.value, disabled: busy }} disabled={busy} onPress={() => setMethod(item.value)} style={[styles.card, { minHeight: 48, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: method === item.value ? colors.soft : colors.background }]}><Text style={styles.label}>{item.label}</Text><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: method === item.value ? colors.text : colors.border, alignItems: "center", justifyContent: "center" }}>{method === item.value && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text }} />}</View></Pressable>)}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Button title="Confirmar cobro" disabled={!method || busy} loading={busy} onPress={() => Alert.alert("¿Registrar este cobro?", `${total} · ${methods.find(item => item.value === method)?.label}`, [{ text: "Volver", style: "cancel" }, { text: "Confirmar cobro", onPress: () => void submit() }])} />
    <Button title="Volver al detalle" variant="ghost" disabled={busy} onPress={onBack} />
  </View>;
}
