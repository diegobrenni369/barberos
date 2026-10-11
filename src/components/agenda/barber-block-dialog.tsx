"use client";
import { DatePicker } from "@/components/ui/date-picker";

import { useState } from "react";
import { createBarberBlock, deleteBarberBlock, updateBarberBlock } from "@/app/actions/barber-availability";
import { AgendaOption } from "@/components/agenda/appointment-dialog";
import { BarberBlockData } from "@/components/agenda/barber-block";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BarberBlockDialog({ open, onOpenChange, block, defaults, barbers, reasons }: { open: boolean; onOpenChange: (open: boolean) => void; block?: BarberBlockData; defaults: { barberId: string; date: string; startTime: string; endTime: string }; barbers: AgendaOption[]; reasons: AgendaOption[] }) {
  const [barberId, setBarberId] = useState(block?.barberId ?? defaults.barberId);
  const [reasonId, setReasonId] = useState(block?.reasonId ?? reasons[0]?.id ?? "");
  const [allDay, setAllDay] = useState(block?.allDay ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const barberName = barbers.find((item) => item.id === barberId)?.name;
  if (block && !editing) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle>Bloqueo</DialogTitle><DialogDescription>{block.reasonName}</DialogDescription></DialogHeader>
    <div className="grid gap-2 py-4 text-sm"><p>{barberName}</p><p>{block.date} · {block.allDay ? "Todo el día" : `${block.startTime}–${block.endTime}`}</p>{block.note && <p className="whitespace-pre-wrap text-muted-foreground">{block.note}</p>}</div>
    <form action={deleteBarberBlock}><input type="hidden" name="id" value={block.id} /><input type="hidden" name="date" value={block.date} />
      {confirmDelete && <p role="alert" className="mb-3 text-sm">¿Eliminar este bloqueo? Esta acción no se puede deshacer.</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(true)}>Editar</Button>{confirmDelete ? <><Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button type="submit" variant="destructive">Confirmar eliminación</Button></> : <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Eliminar bloqueo</Button>}</DialogFooter>
    </form>
  </DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form action={block ? updateBarberBlock : createBarberBlock}><input type="hidden" name="id" value={block?.id ?? ""} /><input type="hidden" name="barberId" value={barberId} /><input type="hidden" name="reasonId" value={reasonId} /><input type="hidden" name="allDay" value={String(allDay)} /><DialogHeader><DialogTitle>{block ? "Editar bloqueo" : "Bloquear horario"}</DialogTitle><DialogDescription>Registra una excepción puntual sin modificar el horario semanal.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><Field label="Barbero"><Select value={barberId} onValueChange={(value) => setBarberId(value ?? "")}><SelectTrigger className="w-full"><SelectValue>{barberName}</SelectValue></SelectTrigger><SelectContent>{barbers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Fecha"><DatePicker name="date" required defaultValue={block?.date ?? defaults.date} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="size-4 accent-primary" />Todo el día</label>{allDay ? <><input type="hidden" name="startTime" value="00:00" /><input type="hidden" name="endTime" value="23:59" /></> : <div className="grid grid-cols-2 gap-4"><Field label="Hora inicio"><Input name="startTime" type="time" required defaultValue={block?.startTime ?? defaults.startTime} /></Field><Field label="Hora fin"><Input name="endTime" type="time" required defaultValue={block?.endTime ?? defaults.endTime} /></Field></div>}<Field label="Motivo"><Select value={reasonId} onValueChange={(value) => setReasonId(value ?? "")}><SelectTrigger className="w-full"><SelectValue>{reasons.find((item) => item.id === reasonId)?.name}</SelectValue></SelectTrigger><SelectContent>{reasons.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Nota opcional"><Textarea name="note" maxLength={500} defaultValue={block?.note ?? ""} placeholder="Agrega un detalle si es necesario" /></Field></div><DialogFooter>{block && (confirmDelete ? <Button type="submit" variant="destructive" formAction={deleteBarberBlock}>Confirmar eliminación</Button> : <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>Eliminar bloqueo</Button>)}<DialogClose nativeButton render={<Button nativeButton type="button" variant="outline" />}>Cancelar</DialogClose><Button type="submit">Guardar bloqueo</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
