import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { colors, styles } from "../../components/ui";
import { SelectedBarberProvider } from "../../lib/selected-barber";

export default function AppLayout() {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  if (!session) return <Redirect href="/login" />;
  return <SelectedBarberProvider key={session.barbershop.id}><View style={styles.screen}>
    <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false }} /></View>
    <SafeAreaView edges={["bottom"]} style={{ borderTopWidth: 1, borderColor: colors.border }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 6, gap: 6 }}>
        {([{ path: "/agenda", title: "Agenda" }, { path: "/customers", title: "Clientes" }, { path: "/commissions", title: "Comisiones" }, { path: "/more", title: "Más" }] as const).map(item => <Pressable key={item.path} accessibilityRole="tab" accessibilityState={{ selected: pathname === item.path }} onPress={() => router.navigate(item.path)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: pathname === item.path ? colors.soft : colors.background }}><Text style={[styles.label, { color: pathname === item.path ? colors.text : colors.muted }]}>{item.title}</Text></Pressable>)}
      </View>
    </SafeAreaView>
  </View></SelectedBarberProvider>;
}
