import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { usePush } from "../../lib/push";
import { Button, Card, styles } from "../../components/ui";

export default function More() {
  const { session, logout } = useAuth();
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function signOut() {
    setBusy(true); setLogoutError("");
    try { await logout(); } catch { setLogoutError("No se pudo cerrar sesión. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, { padding: 16 }]}>
      <Text style={styles.title}>Más</Text>
      <Card><Text style={styles.subtitle}>Cuenta</Text><View style={{ gap: 4 }}><Text style={styles.label}>{session?.user.name}</Text><Text style={styles.muted}>{session?.user.email}</Text></View></Card>
      <Card><Text style={styles.subtitle}>Notificaciones</Text><Text style={styles.muted}>{push.enabled ? "Activadas" : "Desactivadas"}</Text>{!!push.message && <Text style={styles.muted}>{push.message}</Text>}{!push.enabled && <Button title="Activar notificaciones" secondary loading={push.busy} disabled={push.busy} onPress={() => void push.enable()} />}</Card>
      {!!logoutError && <Text accessibilityRole="alert" style={styles.error}>{logoutError}</Text>}
      <Button title="Cerrar sesión" variant="ghost" loading={busy} onPress={() => void signOut()} />
    </ScrollView>
  </SafeAreaView>;
}
