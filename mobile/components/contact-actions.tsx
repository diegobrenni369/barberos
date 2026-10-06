import { Alert, Linking, Pressable, Text, View } from "react-native";
import { colors, styles } from "./ui";

export function ContactActions({ phone }: { phone: string | null | undefined }) {
  const normalized = phone?.replace(/[\s().-]/g, "") ?? "";
  if (!/^\+?\d{7,15}$/.test(normalized)) return null;

  async function openContact(whatsapp: boolean) {
    const url = whatsapp ? `https://wa.me/${normalized.replace(/\D/g, "")}` : `tel:${normalized}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert("No se pudo abrir", whatsapp ? "No se pudo abrir WhatsApp en este dispositivo." : "No se pudo iniciar la llamada en este dispositivo."); }
  }

  return <View style={{ flexDirection: "row", gap: 10 }}>{[{ title: "Llamar", whatsapp: false }, { title: "WhatsApp", whatsapp: true }].map(action => <Pressable key={action.title} accessibilityRole="button" onPress={() => void openContact(action.whatsapp)} style={({ pressed }) => ({ flex: 1, minHeight: 44, padding: 10, borderRadius: 10, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}><Text style={[styles.label, { fontSize: 13 }]}>{action.title}</Text></Pressable>)}</View>;
}
