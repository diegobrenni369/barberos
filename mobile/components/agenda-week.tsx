import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { moveDate, todayIn } from "../lib/agenda";
import { colors, styles } from "./ui";

export function AgendaWeek({ date, timezone, onChange, onToday, professional }: { date: string; timezone: string; onChange: (date: string) => void; onToday?: () => void; professional?: ReactNode }) {
  const [width, setWidth] = useState(0);
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = moveDate(date, -weekday);
  const today = todayIn(timezone);
  const labels = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
  return <View style={{ gap: 4 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flexShrink: 1, minWidth: 0, alignItems: "flex-start", marginRight: "auto" }}>{professional}</View>
      <Text style={[styles.muted, { fontSize: 12, flexShrink: 0 }]}>{new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`))}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver a hoy" onPress={() => onToday ? onToday() : onChange(today)} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}><Text style={[styles.label, { fontSize: 12, transform: [{ translateY: -1 }] }]}>Hoy</Text></Pressable>
    </View>
    {width > 0 && <ScrollView key={`${monday}-${width}`} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: width, y: 0 }} onMomentumScrollEnd={event => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      if (page !== 1) onChange(moveDate(date, (page - 1) * 7));
    }}>
      {[-1, 0, 1].map(week => <View key={week} style={{ width, flexDirection: "row" }}>
        {labels.map((label, day) => {
          const value = moveDate(monday, week * 7 + day);
          const selected = value === date;
          return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", dateStyle: "full" }).format(new Date(`${value}T12:00:00Z`))} onPress={() => onChange(value)} style={{ flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 10, backgroundColor: selected ? colors.text : colors.background }}>
            <Text style={{ fontSize: 11, color: selected ? "#e5e5e5" : colors.muted }}>{label}</Text>
            <Text style={{ fontSize: 17, fontWeight: selected || value === today ? "600" : "400", color: selected ? "white" : colors.text, fontVariant: ["tabular-nums"] }}>{Number(value.slice(8))}</Text>
            <View style={{ width: 3, height: 3, borderRadius: 2, alignSelf: "center", transform: [{ translateY: -2 }], backgroundColor: value === today ? selected ? "white" : colors.text : "transparent" }} />
          </Pressable>;
        })}
      </View>)}
    </ScrollView>}
  </View>;
}
