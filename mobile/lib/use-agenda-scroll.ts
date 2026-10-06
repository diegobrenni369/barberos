import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { todayIn } from "./agenda";

type Grid = { y: number; start: number; end: number; scale: number };

export function useAgendaScroll(date: string, timezone: string, barberId: string | null, ready: boolean) {
  const ref = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, number>());
  const key = `${date}:${barberId ?? ""}`;
  const pending = useRef<"now" | "restore" | null>("now");
  const [request, setRequest] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [height, setHeight] = useState(0);
  const [origin, setOrigin] = useState<{ key: string; y: number } | null>(null);
  const [grid, setGrid] = useState<(Grid & { key: string }) | null>(null);
  const requestScroll = useCallback((mode: "now" | "restore") => {
    pending.current = mode;
    setRequest(value => value + 1);
  }, []);

  useFocusEffect(useCallback(() => {
    requestScroll("now");
    return () => { pending.current = null; };
  }, [requestScroll]));

  useEffect(() => {
    if (!pending.current || !ready || !viewport || !height || grid?.key !== key || origin?.key !== key) return;
    let y = positions.current.get(key) ?? 0;
    if (pending.current === "now" && date === todayIn(timezone)) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(part => [part.type, part.value]));
      const minute = Number(parts.hour) * 60 + Number(parts.minute);
      if (minute >= grid.start && minute < grid.end) y = origin.y + grid.y + (minute - grid.start) * grid.scale - viewport / 3;
    }
    const target = Math.max(0, Math.min(y, height - viewport));
    const frame = requestAnimationFrame(() => {
      if (!pending.current) return;
      pending.current = null;
      ref.current?.scrollTo({ y: target, animated: false });
      positions.current.set(key, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [date, timezone, key, ready, viewport, height, grid, origin, request]);

  return {
    ref, requestScroll, setViewport, setHeight,
    onOrigin: (y: number) => setOrigin({ key, y }),
    onGrid: (value: Grid) => setGrid({ ...value, key }),
    onScroll: (y: number) => { if (ready && !pending.current) positions.current.set(key, Math.max(0, y)); },
    onDrag: () => { pending.current = null; },
  };
}
