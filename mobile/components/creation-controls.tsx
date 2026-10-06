import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Chevron } from "./chevron";
import { SheetHeader } from "./sheet-header";
import { Button, colors, styles } from "./ui";

export const readableDate = (date: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
export function SelectionOption({ title, detail, selected, onPress, selectedIcon = <Check /> }: { title: string; detail?: string; selected?: boolean; onPress: () => void; selectedIcon?: ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: colors.border, backgroundColor: selected || pressed ? colors.soft : colors.background, flexDirection: "row", gap: 12, alignItems: "center" })}><View style={{ flex: 1, gap: 3 }}><Text style={styles.label}>{title}</Text>{!!detail && <Text style={[styles.muted, { fontSize: 12 }]}>{detail}</Text>}</View>{selected && selectedIcon}</Pressable>;
}
export function ActionSurface({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" }}>
      <Pressable accessibilityLabel="Cerrar opciones" accessibilityRole="button" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}><View style={{ padding: 16, gap: 10 }}>{children}<Button title="Cerrar" variant="ghost" onPress={onClose} /></View></SafeAreaView>
    </View>
  </Modal>;
}
export function PickerSurface({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Modal animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.screen}>
    <SheetHeader title={title} action="Listo" onClose={onClose} />
    {children}
  </SafeAreaView></Modal>;
}
export function SelectRow({ label, value, detail, onPress, disabled }: { label: string; value: string; detail?: string; onPress: () => void; disabled?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={[styles.muted, { fontSize: 12 }]}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} disabled={disabled} onPress={onPress} style={{ minHeight: 48, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, flexDirection: "row", gap: 8, alignItems: "center", opacity: disabled ? 0.5 : 1 }}><View style={{ flex: 1, gap: 3 }}><Text style={styles.label}>{value}</Text>{!!detail && <Text style={[styles.muted, { fontSize: 12 }]}>{detail}</Text>}</View><Chevron direction="down" size={20} /></Pressable></View>;
}
export function CompactSelect({ label, value, options, onChange, disabled, selectedIcon = <Check /> }: { label: string; value: string; options: { id: string; title: string; detail?: string }[]; onChange: (id: string) => void; disabled?: boolean; selectedIcon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(item => item.id === value);
  return <><SelectRow label={label} value={selected?.title ?? "Seleccionar"} detail={selected?.detail} disabled={disabled || !options.length} onPress={() => setOpen(true)} />
    {open && <PickerSurface title={label} onClose={() => setOpen(false)}><ScrollView contentContainerStyle={{ padding: 16 }}>{options.map(item => <SelectionOption key={item.id} title={item.title} detail={item.detail} selected={item.id === value} selectedIcon={selectedIcon} onPress={() => { onChange(item.id); setOpen(false); }} />)}</ScrollView></PickerSurface>}
  </>;
}
export function DateControl({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const shift = (amount: number) => { const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + amount); setMonth(next.toISOString().slice(0, 7)); };
  return <><SelectRow label="Fecha" value={readableDate(date)} onPress={() => { setMonth(date.slice(0, 7)); setOpen(true); }} />
    {open && <PickerSurface title="Seleccionar fecha" onClose={() => setOpen(false)}><ScrollView contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 430, width: "100%", alignSelf: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}><Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => shift(-1)} style={{ padding: 12 }}><Chevron direction="left" /></Pressable><Text style={[styles.subtitle, { flex: 1, textAlign: "center" }]}>{new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "long", year: "numeric" }).format(first)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => shift(1)} style={{ padding: 12 }}><Chevron direction="right" /></Pressable></View>
      <View style={{ flexDirection: "row" }}>{["lu", "ma", "mi", "ju", "vi", "sá", "do"].map(day => <Text key={day} style={[styles.muted, { width: "14.2857%", textAlign: "center" }]}>{day}</Text>)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
        const day = index - offset + 1; const key = `${month}-${String(day).padStart(2, "0")}`;
        return day < 1 || day > count ? <View key={index} style={{ width: "14.2857%", height: 48 }} /> : <Pressable key={index} accessibilityRole="button" accessibilityLabel={readableDate(key)} accessibilityState={{ selected: key === date }} onPress={() => { onChange(key); setOpen(false); }} style={{ width: "14.2857%", minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: key === date ? colors.text : colors.background }}><Text style={{ fontSize: 16, color: key === date ? "white" : colors.text }}>{day}</Text></Pressable>;
      })}</View>
    </ScrollView></PickerSurface>}
  </>;
}
export function TimeControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const parts = draft.split(":");
  return <><SelectRow label={label} value={value} onPress={() => { setDraft(value); setOpen(true); }} />
    {open && <PickerSurface title={label} onClose={() => setOpen(false)}>
      <Text style={[styles.title, { textAlign: "center", padding: 16, fontVariant: ["tabular-nums"] }]}>{draft}</Text>
      <View style={{ flex: 1, flexDirection: "row", paddingHorizontal: 20, gap: 12 }}>{[24, 60].map((count, column) => <View key={column} style={{ flex: 1 }}><Text style={[styles.muted, { textAlign: "center", padding: 8 }]}>{column === 0 ? "Hora" : "Minutos"}</Text><ScrollView>{Array.from({ length: count }, (_, index) => String(index).padStart(2, "0")).map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${column === 0 ? "Hora" : "Minuto"} ${item}`} accessibilityState={{ selected: parts[column] === item }} onPress={() => setDraft(column === 0 ? `${item}:${parts[1]}` : `${parts[0]}:${item}`)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: parts[column] === item ? colors.soft : colors.background }}><Text style={styles.label}>{item}</Text></Pressable>)}</ScrollView></View>)}</View>
      <View style={{ padding: 20 }}><Button title="Usar horario" onPress={() => { onChange(draft); setOpen(false); }} /></View>
    </PickerSurface>}
  </>;
}
export function SearchIcon() {
  return <View accessible={false} style={{ width: 22, height: 22 }}><View style={{ position: "absolute", top: 2, left: 2, width: 13, height: 13, borderWidth: 2, borderRadius: 7, borderColor: colors.muted }} /><View style={{ position: "absolute", top: 15, left: 14, width: 8, height: 2, backgroundColor: colors.muted, transform: [{ rotate: "45deg" }] }} /></View>;
}
