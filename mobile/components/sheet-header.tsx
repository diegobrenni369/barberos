import { Pressable, Text, View } from "react-native";
import { colors, styles } from "./ui";

export function SheetHeader({ title, subtitle, action = "Cerrar", onClose, disabled }: { title: string; subtitle?: string; action?: "Listo" | "Cerrar"; onClose: () => void; disabled?: boolean }) {
  return <View style={{ minHeight: 56, flexShrink: 0, paddingHorizontal: 16, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 0.5, borderColor: colors.border }}>
    <View style={{ flex: 1, gap: 3 }}><Text style={styles.subtitle}>{title}</Text>{!!subtitle && <Text style={[styles.muted, { fontSize: 12 }]}>{subtitle}</Text>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onClose} style={({ pressed }) => ({ minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}><Text style={[styles.muted, { fontSize: 14, fontWeight: "500" }]}>{action}</Text></Pressable>
  </View>;
}
