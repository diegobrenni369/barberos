"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Clock3, Copy, Plus, Trash2 } from "lucide-react";
import { saveBarberAvailability } from "@/app/actions/barber-availability";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const days = [{ value: "MONDAY", label: "Lunes", short: "Lun" }, { value: "TUESDAY", label: "Martes", short: "Mar" }, { value: "WEDNESDAY", label: "Miércoles", short: "Mié" }, { value: "THURSDAY", label: "Jueves", short: "Jue" }, { value: "FRIDAY", label: "Viernes", short: "Vie" }, { value: "SATURDAY", label: "Sábado", short: "Sáb" }, { value: "SUNDAY", label: "Domingo", short: "Dom" }] as const;
type BreakRow = { startTime: string; endTime: string; label: string };
type Row = { dayOfWeek: string; enabled: boolean; startTime: string; endTime: string; breaks: BreakRow[] };
type Availability = { dayOfWeek: string; startMinute: number; endMinute: number };
type Break = { dayOfWeek: string; startMinute: number; endMinute: number; label: string | null };
type BusinessHour = { dayOfWeek: string; opensMinute: number; closesMinute: number; isClosed: boolean };

export function BarberScheduleDialog({ barber, availability, breaks, businessHours = [] }: { barber: { id: string; name: string }; availability: Availability[]; breaks: Break[]; businessHours?: BusinessHour[] }) {
  const makeSchedule = () => initialSchedule(availability, breaks, businessHours);
  const [open, setOpen] = useState(false); const [schedule, setSchedule] = useState<Row[]>(makeSchedule); const [editing, setEditing] = useState<number | null>(null); const [targets, setTargets] = useState<number[]>([]);
  const onOpenChange = (next: boolean) => { setOpen(next); if (next) { setSchedule(makeSchedule()); setEditing(null); setTargets([]); } };
  const update = (index: number, patch: Partial<Row>) => setSchedule((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const updateBreak = (dayIndex: number, breakIndex: number, patch: Partial<BreakRow>) => update(dayIndex, { breaks: schedule[dayIndex].breaks.map((item, index) => index === breakIndex ? { ...item, ...patch } : item) });
  const scheduleToSave = editing === null ? schedule : schedule.map((row, index) => targets.includes(index) ? { ...schedule[editing], dayOfWeek: row.dayOfWeek, breaks: schedule[editing].breaks.map((item) => ({ ...item })) } : row);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetTrigger nativeButton render={<Button nativeButton variant="outline" size="sm" />}><Clock3 />{availability.length ? "Editar horario" : "Personalizar horario"}</SheetTrigger><SheetContent className="w-full gap-0 sm:max-w-2xl"><form action={saveBarberAvailability} className="flex min-h-0 flex-1 flex-col"><input type="hidden" name="barberId" value={barber.id} /><input type="hidden" name="schedule" value={JSON.stringify(scheduleToSave)} /><SheetHeader className="border-b pr-12"><SheetTitle>{editing === null ? `Horario de ${barber.name}` : `Editar ${days[editing].label.toLowerCase()}`}</SheetTitle><SheetDescription>{editing === null ? "Define su jornada habitual y descansos recurrentes." : "Configura la jornada y sus descansos recurrentes."}</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto p-4">{editing === null ? <WeekSummary schedule={schedule} onEdit={(index) => { setEditing(index); setTargets([]); }} /> : <DayEditor key={editing} index={editing} row={schedule[editing]} targets={targets} onBack={() => { setSchedule(scheduleToSave); setEditing(null); setTargets([]); }} onUpdate={(patch) => update(editing, patch)} onUpdateBreak={(breakIndex, patch) => updateBreak(editing, breakIndex, patch)} onTargets={setTargets} />}</div><SheetFooter className="sticky bottom-0 flex-row justify-end border-t bg-popover"><SheetClose nativeButton render={<Button nativeButton type="button" variant="outline" />}>Cancelar</SheetClose><Button type="submit">Guardar cambios</Button></SheetFooter></form></SheetContent></Sheet>;
}

function WeekSummary({ schedule, onEdit }: { schedule: Row[]; onEdit: (index: number) => void }) { return <div><div className="hidden grid-cols-[120px_1fr_1.25fr_24px] gap-3 border-b px-3 pb-2 text-xs font-medium text-muted-foreground sm:grid"><span>Día</span><span>Jornada</span><span>Descansos</span><span /></div><div className="divide-y">{schedule.map((row, index) => <button key={row.dayOfWeek} type="button" onClick={() => onEdit(index)} className="grid w-full gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[120px_1fr_1.25fr_24px] sm:items-center sm:gap-3"><span className="text-sm font-medium">{days[index].label}</span><span className={row.enabled ? "text-sm tabular-nums" : "text-sm text-muted-foreground"}>{row.enabled ? `${row.startTime} – ${row.endTime}` : "No trabaja"}</span><span className="text-xs text-muted-foreground sm:text-sm">{breakSummary(row)}</span><ChevronRight className="hidden size-4 text-muted-foreground sm:block" /></button>)}</div></div>; }

function DayEditor({ index, row, targets, onBack, onUpdate, onUpdateBreak, onTargets }: { index: number; row: Row; targets: number[]; onBack: () => void; onUpdate: (patch: Partial<Row>) => void; onUpdateBreak: (index: number, patch: Partial<BreakRow>) => void; onTargets: (value: number[]) => void }) {
  const [copyOpen, setCopyOpen] = useState(false);
  return <div className="space-y-6">
    <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft />Volver a la semana</Button>
    <div className="flex items-center justify-between border-b pb-4">
      <div><div className="text-sm font-medium">{days[index].label}</div><div className="text-xs text-muted-foreground">{row.enabled ? "Día laboral" : "No trabaja"}</div></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={row.enabled} onCheckedChange={(checked) => onUpdate({ enabled: checked })} />Activo</label>
    </div>
    {row.enabled && <>
      <section><div className="mb-3 text-sm font-medium">Jornada</div><div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Time label="Inicio" value={row.startTime} onChange={(value) => onUpdate({ startTime: value })} />
        <Time label="Fin" value={row.endTime} onChange={(value) => onUpdate({ endTime: value })} />
      </div></section>
      <section><div className="mb-3 text-sm font-medium">Descansos</div>
        {row.breaks.length ? <div className="divide-y">{row.breaks.map((item, breakIndex) => <div key={breakIndex} className="flex flex-wrap items-center gap-2 py-3 first:pt-0">
          <Input className="min-w-[160px] flex-[1_1_160px] tabular-nums" aria-label="Inicio del descanso" type="time" value={item.startTime} onChange={(event) => onUpdateBreak(breakIndex, { startTime: event.target.value })} />
          <Input className="min-w-[160px] flex-[1_1_160px] tabular-nums" aria-label="Fin del descanso" type="time" value={item.endTime} onChange={(event) => onUpdateBreak(breakIndex, { endTime: event.target.value })} />
          <Input className="min-w-[120px] flex-[1_1_120px]" aria-label="Nombre del descanso" value={item.label} placeholder="Almuerzo" maxLength={80} onChange={(event) => onUpdateBreak(breakIndex, { label: event.target.value })} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Eliminar descanso" onClick={() => onUpdate({ breaks: row.breaks.filter((_, itemIndex) => itemIndex !== breakIndex) })}><Trash2 /></Button>
        </div>)}</div> : <p className="text-sm text-muted-foreground">Sin descansos configurados.</p>}
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onUpdate({ breaks: [...row.breaks, { startTime: "13:00", endTime: "14:00", label: "" }] })}><Plus />Agregar descanso</Button>
      </section>
    </>}
    <section>
      <Button type="button" variant="ghost" size="sm" aria-expanded={copyOpen} onClick={() => { setCopyOpen(!copyOpen); }}><Copy />Copiar a otros días</Button>
      {copyOpen && <fieldset className="mt-3 rounded-lg border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-medium">Copiar horario del {days[index].label.toLowerCase()} a:</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{days.map((day, dayIndex) => dayIndex !== index && <label key={day.value} className="flex items-center gap-2 text-sm">
          <Checkbox checked={targets.includes(dayIndex)} onCheckedChange={(checked) => onTargets(checked ? [...targets, dayIndex] : targets.filter((item) => item !== dayIndex))} />{day.short}
        </label>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Al guardar, se copiarán la jornada y los descansos a los días seleccionados. Desmarca un día para excluirlo.</p>
      </fieldset>}
      {targets.length > 0 && <p role="status" className="mt-2 text-xs text-muted-foreground">Se copiará también a: {targets.map((target) => days[target].label).join(", ")}.</p>}
    </section>
  </div>;
}

function breakSummary(row: Row) { if (!row.enabled) return ""; if (!row.breaks.length) return "Sin descansos"; if (row.breaks.length === 1) { const item = row.breaks[0]; return `${item.startTime}–${item.endTime}${item.label ? ` ${item.label}` : ""}`; } return `${row.breaks.length} descansos`; }
function Time({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-xs text-muted-foreground">{label}<Input className="min-w-[160px] tabular-nums" type="time" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function initialSchedule(availability: Availability[], breaks: Break[], businessHours: BusinessHour[]): Row[] { const configured = availability.length > 0; return days.map((day) => { const row = availability.find((item) => item.dayOfWeek === day.value); const business = businessHours.find((item) => item.dayOfWeek === day.value); return { dayOfWeek: day.value, enabled: configured ? Boolean(row) : Boolean(business && !business.isClosed), startTime: row ? toTime(row.startMinute) : toTime(business?.opensMinute ?? 480), endTime: row ? toTime(row.endMinute) : toTime(business?.closesMinute ?? 1200), breaks: breaks.filter((item) => item.dayOfWeek === day.value).map((item) => ({ startTime: toTime(item.startMinute), endTime: toTime(item.endMinute), label: item.label ?? "" })) }; }); }
function toTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
