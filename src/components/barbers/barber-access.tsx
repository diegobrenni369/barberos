"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignBarberAccess, createBarberAccess } from "@/app/actions/barber-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AccessUser = { id: string; name: string; email: string };
export function BarberAccess({ barberId, userId, users, currentUser }: { barberId: string; userId: string | null; users: AccessUser[]; currentUser: AccessUser | null }) {
  const [mode, setMode] = useState<"create" | "associate" | "revoke" | null>(null);
  const [value, setValue] = useState(userId ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  const items = users.map(user => ({ value: user.id, label: `${user.name} · ${user.email}` }));
  function submit(form: FormData, create = false) {
    form.set("barberId", barberId);
    startTransition(async () => {
      try {
        const result = create ? await createBarberAccess(form) : await assignBarberAccess({ message: "" }, form);
        if (!result.ok) { toast.error(result.message); return; }
        setMode(null); toast.success(result.message); router.refresh();
      } catch { toast.error("No se pudo actualizar el acceso. Intenta nuevamente."); }
    });
  }
  return <>
    <div className="flex flex-col items-start gap-3">
      <div className="min-w-0 space-y-1">
        {userId ? <><p className="text-sm font-medium">{currentUser?.name ?? "Usuario asociado"}</p><p className="break-all text-xs text-muted-foreground">{currentUser?.email ?? "Revisa la asociación de este usuario."}</p>{users.some(user => user.id === userId) && <Badge variant="secondary">BARBER</Badge>}</> : <p className="text-sm text-muted-foreground">Sin acceso configurado.</p>}
      </div>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        {userId ? <><Button size="sm" variant="outline" onClick={() => { setValue(userId); setMode("associate"); }}>Cambiar acceso</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => setMode("revoke")}>Revocar</Button></> : <><Button size="sm" variant="outline" onClick={() => setMode("create")}>Crear acceso</Button><Button size="sm" variant="ghost" onClick={() => { setValue(""); setMode("associate"); }}>Asociar existente</Button></>}
      </div>
    </div>
    <Dialog open={mode === "create" || mode === "associate"} onOpenChange={open => { if (!open && !pending) setMode(null); }}>
      <DialogContent className="max-w-sm" showCloseButton={!pending}>
        <DialogHeader><DialogTitle>{mode === "create" ? "Crear acceso Mobile" : "Asociar usuario"}</DialogTitle><DialogDescription>{mode === "create" ? "La contraseña inicial solo se aplica a usuarios nuevos." : "Selecciona un usuario BARBER elegible de esta barbería."}</DialogDescription></DialogHeader>
        <form action={form => submit(form, mode === "create")} className="grid gap-3">
          {mode === "create" ? <>
            <div className="grid gap-2"><Label htmlFor={`${id}-email`}>Email de acceso</Label><Input id={`${id}-email`} name="email" type="email" required disabled={pending} /></div>
            <div className="grid gap-2"><Label htmlFor={`${id}-password`}>Contraseña inicial</Label><Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={100} required disabled={pending} /></div>
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Un usuario existente conserva su contraseña.</p>
          </> : <>
            <Label htmlFor={id}>Usuario</Label>
            <Select name="userId" value={value || null} items={items} onValueChange={next => setValue(next ?? "")} disabled={pending}>
              <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            {!users.length && <p className="text-xs text-muted-foreground">No hay usuarios BARBER elegibles para asociar.</p>}
          </>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>Cancelar</Button><Button type="submit" disabled={pending || (mode === "associate" && !users.some(user => user.id === value))}>{pending ? "Guardando…" : mode === "create" ? "Crear acceso" : "Guardar"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={mode === "revoke"} onOpenChange={open => { if (!open && !pending) setMode(null); }}>
      <AlertDialogContent>
        <AlertDialogTitle className="font-semibold">¿Revocar acceso Mobile?</AlertDialogTitle>
        <AlertDialogDescription>Se cerrarán las sesiones móviles del usuario. Su cuenta y membresía se conservarán.</AlertDialogDescription>
        <div className="flex justify-end gap-2"><AlertDialogCancel render={<Button variant="outline" disabled={pending} />}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={pending} onClick={() => { const form = new FormData(); form.set("userId", "none"); submit(form); }}>{pending ? "Revocando…" : "Revocar"}</Button></div>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
