import { useEffect, useState } from "react";
import { AppState, View } from "react-native";

export function CurrentTimeLine({ date, timezone, start, end, pixelsPerMinute }: { date: string; timezone: string; start: number; end: number; pixelsPerMinute: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(part => [part.type, part.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  if (date !== `${parts.year}-${parts.month}-${parts.day}` || minute < start || minute >= end) return null;
  return <View pointerEvents="none" accessible={false} style={{ position: "absolute", zIndex: 20, left: 36, right: 0, top: (minute - start) * pixelsPerMinute, height: 1, backgroundColor: "#ef4444" }}><View style={{ position: "absolute", left: -3, top: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444" }} /></View>;
}
