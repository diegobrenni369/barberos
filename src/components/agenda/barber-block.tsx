"use client";

import { LockKeyhole } from "lucide-react";
import { AGENDA_PIXELS_PER_MINUTE, AGENDA_TOP_GUTTER } from "@/lib/agenda";

export type BarberBlockData = { id: string; barberId: string; date: string; startTime: string; endTime: string; allDay: boolean; reasonId: string; reasonName: string; note: string };

export function BarberBlock({ block, gridStartMinute, gridEndMinute, onClick }: { block: BarberBlockData; gridStartMinute: number; gridEndMinute: number; onClick: () => void }) {
  const start = block.allDay ? gridStartMinute : toMinute(block.startTime);
  const end = block.allDay ? gridEndMinute : toMinute(block.endTime);
  const visibleStart = Math.max(start, gridStartMinute); const visibleEnd = Math.min(end, gridEndMinute);
  if (visibleStart >= visibleEnd) return null;
  const height = (visibleEnd - visibleStart) * AGENDA_PIXELS_PER_MINUTE;
  const timeLabel = block.allDay ? "Todo el día" : `${block.startTime}–${block.endTime}`;
  const summary = ["Bloqueado", block.reasonName, timeLabel, block.note].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      title={summary}
      aria-label={summary}
      className="absolute z-[8] overflow-hidden rounded-md border border-slate-300/70 bg-slate-100/85 px-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300"
      style={{ left: 4, right: 4, top: AGENDA_TOP_GUTTER + (visibleStart - gridStartMinute) * AGENDA_PIXELS_PER_MINUTE, height }}
    >
      <div className="flex h-full min-w-0 flex-col justify-center">
        <div className="flex min-w-0 items-center justify-between gap-2 leading-4">
          <span className="flex min-w-0 items-center gap-1 font-medium">
            <LockKeyhole className="size-3 shrink-0" />
            <span className="truncate">{height < 40 ? block.reasonName : "Bloqueado"}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums opacity-70">{timeLabel}</span>
        </div>
        {height >= 40 && <div className="truncate text-[11px] leading-4 opacity-75">{block.reasonName}</div>}
        {height >= 64 && block.note && <div className="truncate text-[10px] leading-4 opacity-65">{block.note}</div>}
      </div>
    </button>
  );
}

function toMinute(time: string) { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
