"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { BarberBlockDialog } from "@/components/agenda/barber-block-dialog";
import { BarberBlockData } from "@/components/agenda/barber-block";
import { Button } from "@/components/ui/button";

export function BarberBlocksPanel({ barber, blocks, reasons }: { barber: { id: string; name: string }; blocks: BarberBlockData[]; reasons: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<BarberBlockData | null>(null);
  if (!blocks.length) return <p className="text-sm text-muted-foreground">No hay bloqueos próximos.</p>;
  return <><div className="divide-y">{blocks.map((block) => <div key={block.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium">{block.reasonName}</p><p className="text-xs tabular-nums text-muted-foreground">{block.date} · {block.allDay ? "Todo el día" : `${block.startTime}–${block.endTime}`}</p>{block.note && <p className="mt-1 text-xs text-muted-foreground">{block.note}</p>}</div><Button type="button" size="icon-sm" variant="ghost" aria-label="Editar bloqueo" onClick={() => setSelected(block)}><Pencil /></Button></div>)}</div>{selected && <BarberBlockDialog open onOpenChange={(open) => { if (!open) setSelected(null); }} block={selected} defaults={{ barberId: barber.id, date: selected.date, startTime: selected.startTime, endTime: selected.endTime }} barbers={[barber]} reasons={reasons} />}</>;
}
