import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from "react-native";

export const colors = { background: "#ffffff", text: "#171717", muted: "#737373", border: "#e5e5e5", soft: "#f5f5f5", error: "#b91c1c" };
export function Button({ title, onPress, disabled, loading, secondary = false, variant, compact = false }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean; variant?: "ghost" | "destructive"; compact?: boolean }) {
  const foreground = variant === "destructive" ? colors.error : variant === "ghost" ? colors.muted : secondary ? colors.text : "white";
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, compact && { minHeight: 44, minWidth: 44, padding: 10 }, variant === "ghost" && { backgroundColor: "transparent", borderWidth: 0 }, variant === "destructive" && { backgroundColor: "#fff7f7", borderWidth: 1, borderColor: "#fee2e2" }, { opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 }]}>{loading ? <ActivityIndicator color={foreground} /> : <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>}</Pressable>;
}
export function Input({ label, style, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, focused && { borderColor: colors.text }, style]} /></View>;
}
export function Card({ style, ...props }: ViewProps) { return <View {...props} style={[styles.card, style]} />; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "red" | "amber" }) {
  const palette = { neutral: ["#f5f5f5", "#525252"], blue: ["#eff6ff", "#1d4ed8"], green: ["#ecfdf5", "#047857"], red: ["#fef2f2", "#b91c1c"], amber: ["#fffbeb", "#92400e"] }[tone];
  return <View style={{ alignSelf: "flex-start", backgroundColor: palette[0], borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: palette[1], fontSize: 12 }}>{children}</Text></View>;
}
export function Avatar({ name }: { name: string }) { return <View accessibilityLabel={name} style={styles.avatar}><Text style={styles.label}>{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</Text></View>; }
export function Separator() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />; }
export function EmptyState({ title, description }: { title: string; description?: string }) { return <Card><Text style={styles.subtitle}>{title}</Text>{description && <Text style={styles.muted}>{description}</Text>}</Card>; }
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  error: { fontSize: 14, lineHeight: 20, color: colors.error },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  button: { minHeight: 48, borderRadius: 10, padding: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.text },
  buttonText: { fontSize: 15, fontWeight: "600", color: "white" },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  card: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 16, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" },
});
