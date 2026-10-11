import { useRef, useState } from "react";
import { Alert, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { type MobileBlock } from "../lib/agenda";
import { SheetHeader } from "./sheet-header";
import { Button, colors, styles } from "./ui";

export function BlockSheet({ block, timezone, onClose, onDeleted }: { block: MobileBlock; timezone: string; onClose: () => void; onDeleted: (id: string) => void }) {
  const { get } = useAuth();
  const insets = useSafeAreaInsets();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!pending.current) onClose(); };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !pending.current && gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => { if (gesture.dy > 45) close(); },
  });
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await get(`/api/mobile/blocks/${encodeURIComponent(block.id)}/delete`, { method: "POST", body: {} });
      onDeleted(block.id);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) { onDeleted(block.id); return; }
      setError("No se pudo eliminar el bloqueo. Intenta nuevamente.");
    } finally { pending.current = false; setBusy(false); }
  }
  const format = (value: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  return <Modal transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar bloqueo" onPress={close} style={{ position: "absolute", inset: 0 }} />
      <View accessibilityViewIsModal style={{ maxHeight: "90%", backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom }}>
        <View {...pan.panHandlers} style={{ padding: 12, alignItems: "center" }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
        <SheetHeader title="Bloqueo" onClose={close} disabled={busy} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={styles.subtitle}>{block.label}</Text>
          <View style={{ gap: 4 }}><Text style={styles.muted}>Inicio: {format(block.startsAt)}</Text><Text style={styles.muted}>Fin: {format(block.endsAt)}</Text></View>
          {!!block.note && <Text style={styles.muted}>{block.note}</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Button title="Eliminar bloqueo" variant="destructive" disabled={busy} loading={busy} onPress={() => Alert.alert("¿Eliminar este bloqueo?", "Esta acción no se puede deshacer.", [{ text: "Cancelar", style: "cancel" }, { text: "Eliminar bloqueo", style: "destructive", onPress: () => void remove() }])} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
