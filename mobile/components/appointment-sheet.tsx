import { useRef, useState } from "react";
import { Alert, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type MobileAppointment } from "../lib/agenda";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { appointmentAppearance } from "./agenda-timeline";
import { Badge, Button, Card, Separator, colors, styles } from "./ui";
import { AppointmentCheckout } from "./appointment-checkout";
import { SheetHeader } from "./sheet-header";
import { ContactActions } from "./contact-actions";

type Status = "CONFIRMED" | "CANCELLED" | "NO_SHOW";
export function AppointmentSheet({ appointment, timezone, onClose, onChanged, onRefresh, onPaid }: {
  appointment: MobileAppointment; timezone: string; onClose: () => void;
  onChanged: (id: string, status: Status) => void; onRefresh: () => void; onPaid: (id: string) => void;
}) {
  const { get } = useAuth();
  const insets = useSafeAreaInsets();
  const pending = useRef(false);
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const close = () => { if (!pending.current) onClose(); };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !pending.current && gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => { if (gesture.dy > 45) close(); },
  });
  async function change(status: Status) {
    if (pending.current) return;
    pending.current = true; setBusy(status); setError("");
    try {
      const result = await get<{ id: string; status: Status }>(`/api/mobile/appointments/${encodeURIComponent(appointment.id)}/status`, { method: "PATCH", body: { status } });
      onChanged(result.id, result.status);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? "La reserva cambió o no permite esta acción. Actualiza la agenda." : failure instanceof ApiError && failure.status === 404 ? "La reserva ya no está disponible." : "No se pudo actualizar la reserva. Revisa la agenda antes de reintentar.");
    } finally { pending.current = false; setBusy(null); }
  }
  function confirm(status: "CANCELLED" | "NO_SHOW") {
    Alert.alert(status === "CANCELLED" ? "¿Cancelar esta cita?" : "¿Marcar como no asistió?", appointment.customerName, [
      { text: "Volver", style: "cancel" },
      { text: status === "CANCELLED" ? "Cancelar cita" : "No asistió", style: "destructive", onPress: () => void change(status) },
    ]);
  }
  const appearance = appointmentAppearance[appointment.status];
  const format = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CL", { ...options, timeZone: timezone }).format(new Date(value));
  return <Modal transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalle" disabled={!!busy || checkoutBusy} onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View accessibilityViewIsModal style={{ maxHeight: "90%", backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom }}>
        <View {...pan.panHandlers} accessibilityLabel="Desliza hacia abajo para cerrar" style={{ padding: 12, flexShrink: 0, alignItems: "center" }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
        <SheetHeader title={checkout ? "Cobrar atención" : "Reserva"} onClose={close} disabled={!!busy || checkoutBusy} />
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 20, width: "100%", maxWidth: 520, alignSelf: "center" }}>
          {checkout ? <AppointmentCheckout appointment={appointment} onBack={() => setCheckout(false)} onBusy={value => { pending.current = value; setCheckoutBusy(value); }} onSuccess={() => { onPaid(appointment.id); setPaid(true); setCheckout(false); }} /> : <>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={[styles.title, { flex: 1, fontSize: 26, lineHeight: 32 }]}>{appointment.customerName}</Text>
              <View style={{ flexShrink: 0 }}><Badge tone={appearance.tone}>{appearance.label}</Badge></View>
            </View>
            <Text style={[styles.muted, { fontSize: 16, lineHeight: 24 }]}>{appointment.serviceName}</Text>
          </View>
          <Card style={{ backgroundColor: "#fafafa", gap: 14 }}>
            <View style={{ gap: 5 }}>
              <Text style={[styles.muted, { fontSize: 12 }]}>Fecha y hora</Text>
              <Text style={styles.label}>{format(appointment.startsAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text>
              <Text style={[styles.subtitle, { fontSize: 20, fontVariant: ["tabular-nums"] }]}>{format(appointment.startsAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–{format(appointment.endsAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</Text>
            </View>
            <Separator />
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
              <View style={{ flexGrow: 1, flexShrink: 1, gap: 5 }}><Text style={[styles.muted, { fontSize: 12 }]}>Profesional</Text><Text style={styles.label}>{appointment.barberName}</Text></View>
              <View style={{ gap: 5 }}><Text style={[styles.muted, { fontSize: 12 }]}>Precio</Text><Text style={[styles.subtitle, { fontSize: 16 }]}>{new Intl.NumberFormat("es-CL", { style: "currency", currency: appointment.currency }).format(Number(appointment.price))}</Text></View>
            </View>
          </Card>
          {!!appointment.phone && <View style={{ gap: 8 }}><Text style={[styles.muted, { fontSize: 12, fontWeight: "600" }]}>Contacto</Text><Card style={{ padding: 14, gap: 10 }}><View style={{ gap: 4 }}><Text style={[styles.muted, { fontSize: 12 }]}>Teléfono</Text><Text selectable style={[styles.label, { fontSize: 16, lineHeight: 24 }]}>{appointment.phone}</Text></View><ContactActions phone={appointment.phone} /></Card></View>}
          {!!appointment.notes && <View style={{ gap: 8 }}><Text style={[styles.muted, { fontSize: 12, fontWeight: "600" }]}>Notas</Text><Text style={[styles.label, { lineHeight: 22 }]}>{appointment.notes}</Text></View>}
          {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button secondary title="Actualizar agenda" disabled={!!busy} onPress={() => { onClose(); onRefresh(); }} /></>}
          {!!appointment.paymentLabel && <View style={{ gap: 8 }}>
            <Text style={[styles.muted, { fontSize: 12, fontWeight: "600" }]}>Pago</Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Badge>{appointment.paymentLabel}</Badge>
              {!!appointment.payment?.methods && <Text style={styles.label}>{appointment.payment.methods}</Text>}
            </View>
            {appointment.payment && <Text style={styles.subtitle}>{new Intl.NumberFormat("es-CL", { style: "currency", currency: appointment.payment.currency }).format(Number(appointment.payment.amount))}</Text>}
          </View>}
          {paid && <Text accessibilityRole="alert" style={styles.muted}>Cobro registrado.</Text>}
          {appointment.canCharge && <Button title="Cobrar" disabled={!!busy} onPress={() => setCheckout(true)} />}
          {appointment.canChangeStatus && <View style={{ gap: 10 }}>
            <Separator />
            {appointment.status === "SCHEDULED" && <Button title="Confirmar cita" disabled={!!busy} loading={busy === "CONFIRMED"} onPress={() => void change("CONFIRMED")} />}
            {["SCHEDULED", "CONFIRMED"].includes(appointment.status) && <>
              <Button title="Cancelar cita" variant="destructive" disabled={!!busy} loading={busy === "CANCELLED"} onPress={() => confirm("CANCELLED")} />
              <Button title="Marcar no asistió" secondary disabled={!!busy} loading={busy === "NO_SHOW"} onPress={() => confirm("NO_SHOW")} />
            </>}
          </View>}
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
