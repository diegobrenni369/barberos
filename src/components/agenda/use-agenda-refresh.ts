"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function useAgendaRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!pending) inFlight.current = false;
  }, [pending]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible" || inFlight.current) return;
      inFlight.current = true;
      startTransition(() => router.refresh());
    };
    const schedule = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") timer = setInterval(refresh, 30_000);
    };
    const onVisibility = () => { schedule(); refresh(); };
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
}
