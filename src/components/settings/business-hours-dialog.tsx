"use client";

import { useId, useState } from "react";
import { Clock3, Copy } from "lucide-react";
import { saveBusinessHours } from "@/app/actions/barbershop";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { businessDays as days, formatBusinessTime as clock, type StoredBusinessHour as StoredHour } from "@/lib/business-hours";

type Row = { dayOfWeek: string; opensAt: string; closesAt: string; isClosed: boolean };

export function BusinessHoursDialog({ hours }: { hours: StoredHour[] }) {
  const id = useId();
  const initial = () => days.map((day) => {
    const value = hours.find((item) => item.dayOfWeek === day.value);
    return { dayOfWeek: day.value, opensAt: clock(value?.opensMinute ?? 480), closesAt: clock(value?.closesMinute ?? 1200), isClosed: value?.isClosed ?? false };
  });
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<Row[]>(initial);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const update = (index: number, patch: Partial<Row>) => setSchedule((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const applyCopy = () => {
    if (copyFrom === null) return;
    setSchedule((current) => current.map((row, index) => targets.includes(index) ? { ...current[copyFrom], dayOfWeek: row.dayOfWeek } : row));
    setNotice(`Horario copiado a ${targets.length} ${targets.length === 1 ? "día" : "días"}. Guarda los cambios para confirmar.`);
    setCopyFrom(null);
    setTargets([]);
  };

  return <Sheet open={open} onOpenChange={(next) => {
    setOpen(next);
    if (next) { setSchedule(initial()); setCopyFrom(null); setTargets([]); setNotice(""); }
  }}>
    <SheetTrigger nativeButton render={<Button nativeButton variant="outline" size="sm" />}><Clock3 />Editar horario</SheetTrigger>
    <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
      <form action={saveBusinessHours} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="schedule" value={JSON.stringify(schedule)} />
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Horario de atención</SheetTitle>
          <SheetDescription>Define cuándo abre tu barbería. Puedes copiar un horario a otros días.</SheetDescription>
        </SheetHeader>
        <div className="@container min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          <div className="divide-y">
            {schedule.map((row, index) => <div key={row.dayOfWeek} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="flex min-w-[100px] flex-1 items-center justify-between gap-2">
                <span className="text-sm font-medium">{days[index].label}</span>
                <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Copiar horario del ${days[index].label.toLowerCase()} a otros días`} title="Copiar a otros días" aria-expanded={copyFrom === index} aria-controls={`${id}-copy`} onClick={() => { setCopyFrom(copyFrom === index ? null : index); setTargets([]); setNotice(""); }}><Copy className="size-3.5" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input aria-label={`Apertura del ${days[index].label.toLowerCase()}`} className="w-[160px] min-w-[160px] shrink-0 tabular-nums disabled:opacity-35" type="time" value={row.opensAt} disabled={row.isClosed} onChange={(event) => update(index, { opensAt: event.target.value })} />
                <Input aria-label={`Cierre del ${days[index].label.toLowerCase()}`} className="w-[160px] min-w-[160px] shrink-0 tabular-nums disabled:opacity-35" type="time" value={row.closesAt} disabled={row.isClosed} onChange={(event) => update(index, { closesAt: event.target.value })} />
                <label className="flex h-8 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs">
                  <Switch checked={!row.isClosed} aria-label={`${days[index].label} abierto`} onCheckedChange={(checked) => update(index, { isClosed: !checked })} />
                  <span className={row.isClosed ? "text-muted-foreground" : "text-foreground"}>{row.isClosed ? "Cerrado" : "Abierto"}</span>
                </label>
              </div>
            </div>)}
          </div>
          {copyFrom !== null && <fieldset id={`${id}-copy`} className="mt-4 rounded-lg border bg-muted/20 p-4">
            <legend className="px-1 text-sm font-medium">Copiar horario del {days[copyFrom].label.toLowerCase()} a:</legend>
            <p className="mb-3 text-xs tabular-nums text-muted-foreground">{schedule[copyFrom].isClosed ? "Cerrado" : `${schedule[copyFrom].opensAt}–${schedule[copyFrom].closesAt}`}</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 @min-[640px]:grid-cols-6">
              {days.map((day, index) => index !== copyFrom && <label key={day.value} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={targets.includes(index)} onCheckedChange={(checked) => setTargets((current) => checked ? [...current, index] : current.filter((target) => target !== index))} /><span>{day.label.slice(0, 3)}</span></label>)}
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { setCopyFrom(null); setTargets([]); }}>Cerrar</Button><Button type="button" variant="secondary" size="sm" disabled={!targets.length} onClick={applyCopy}>Aplicar copia</Button></div>
          </fieldset>}
          <p role="status" className="mt-3 text-xs text-muted-foreground">{notice}</p>
        </div>
        <SheetFooter className="shrink-0 flex-row justify-end border-t bg-popover">
          <SheetClose nativeButton render={<Button nativeButton type="button" variant="outline" />}>Cancelar</SheetClose>
          <Button type="submit">Guardar cambios</Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>;
}
