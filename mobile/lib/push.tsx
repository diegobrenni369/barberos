import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import type * as Notifications from "expo-notifications";
import { useAuth } from "./auth";
import { useSelectedBarber } from "./selected-barber";

type PushState = { enabled: boolean; busy: boolean; message: string; enable: () => Promise<void> };
const Context = createContext<PushState | null>(null);
const supported = (Platform.OS === "ios" || Platform.OS === "android") && Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export function PushProvider({ children }: { children: ReactNode }) {
  const { session, get } = useAuth();
  const { setBarberId } = useSelectedBarber();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const working = useRef(false);
  const alive = useRef(true);
  const sync = useCallback(async (ask: boolean) => {
    if (working.current || !session) return;
    if (!supported) { setMessage("Push requiere un dispositivo físico y un development build."); return; }
    if (typeof projectId !== "string" || !projectId) { setMessage("Falta vincular este build al proyecto EAS."); return; }
    working.current = true; setBusy(true);
    try {
      // Lazy import keeps Expo Go usable without the remote push native module.
      const notifications = await import("expo-notifications");
      if (Platform.OS === "android") await notifications.setNotificationChannelAsync("operational", { name: "Agenda", importance: notifications.AndroidImportance.DEFAULT });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && ask && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
      if (!permission.granted) {
        await get("/api/mobile/push/revoke", { method: "POST", body: {} });
        if (alive.current) { setEnabled(false); setMessage("Notificaciones desactivadas. Puedes habilitarlas en Ajustes."); }
        if (ask && !permission.canAskAgain) Alert.alert("Notificaciones desactivadas", "Puedes habilitarlas en los ajustes del dispositivo.", [{ text: "Ahora no", style: "cancel" }, { text: "Abrir ajustes", onPress: () => { void Linking.openSettings(); } }]);
        return;
      }
      const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!alive.current) return;
      await get("/api/mobile/push/register", { method: "POST", body: { token, platform: Platform.OS } });
      if (alive.current) { setEnabled(true); setMessage(""); }
    } catch { if (alive.current) { setEnabled(false); setMessage("No se pudieron activar las notificaciones. Puedes reintentar."); } }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }, [get, session]);

  useEffect(() => {
    alive.current = true;
    if (!supported || !session || typeof projectId !== "string" || !projectId) return () => { alive.current = false; };
    let disposed = false;
    let responseSubscription: { remove: () => void } | undefined;
    let tokenSubscription: { remove: () => void } | undefined;
    let notifications: typeof Notifications | undefined;
    const matches = (data: Record<string, unknown>) => data.type === "appointment" && data.barbershopId === session.barbershop.id && (session.role === "OWNER" || data.barberId === session.barberId);
    const receive = (response: Notifications.NotificationResponse) => {
      if (disposed || !notifications) return;
      const data = response.notification.request.content.data ?? {};
      void notifications.clearLastNotificationResponseAsync();
      if (!matches(data) || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || typeof data.barberId !== "string") return;
      const parsed = new Date(`${data.date}T12:00:00Z`);
      if (Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== data.date) return;
      if (session.role === "OWNER") setBarberId(data.barberId);
      router.navigate({ pathname: "/agenda", params: { pushDate: data.date, pushKey: response.notification.request.identifier } });
    };
    void (async () => {
      notifications = await import("expo-notifications");
      if (disposed) return;
      notifications.setNotificationHandler({ handleNotification: async notification => {
        const show = !disposed && matches(notification.request.content.data ?? {});
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      } });
      responseSubscription = notifications.addNotificationResponseReceivedListener(receive);
      tokenSubscription = notifications.addPushTokenListener(() => { void sync(false); });
      const last = await notifications.getLastNotificationResponseAsync();
      if (last) receive(last);
      await sync(false);
      const key = `barberos.push.prompt.${session.user.id}`;
      const permission = await notifications.getPermissionsAsync();
      if (!disposed && !permission.granted && permission.canAskAgain && !await SecureStore.getItemAsync(key)) {
        await SecureStore.setItemAsync(key, "shown");
        if (!disposed) Alert.alert("Notificaciones de Agenda", "¿Quieres recibir avisos de reservas nuevas, cancelaciones y cambios de horario?", [{ text: "Ahora no", style: "cancel" }, { text: "Activar", onPress: () => { if (!disposed) void sync(true); } }]);
      }
    })().catch(() => { if (!disposed) setMessage("No se pudieron preparar las notificaciones."); });
    const appState = AppState.addEventListener("change", state => { if (state === "active") void sync(false); });
    return () => { disposed = true; alive.current = false; responseSubscription?.remove(); tokenSubscription?.remove(); appState.remove(); notifications?.setNotificationHandler(null); };
  }, [session, sync, router, setBarberId]);

  return <Context.Provider value={{ enabled, busy, message, enable: () => sync(true) }}>{children}</Context.Provider>;
}
export function usePush() { const value = useContext(Context); if (!value) throw new Error("PushProvider required"); return value; }
