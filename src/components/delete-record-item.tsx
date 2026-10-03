"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord } from "@/app/actions/delete-record";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function DeleteRecordItem({ kind, id, name }: { kind: "customer" | "barber" | "service"; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const cancel = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const label = kind === "customer" ? "cliente" : kind === "barber" ? "barbero" : "servicio";
  return <>
    <DropdownMenuItem variant="destructive" closeOnClick={false} onClick={() => { setError(""); setOpen(true); }}>Eliminar</DropdownMenuItem>
    <AlertDialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
      <AlertDialogContent initialFocus={cancel}>
        <AlertDialogTitle className="text-base font-semibold">¿Eliminar este {label}?</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">{name}. Esta acción no se puede deshacer. Si tiene actividad o relaciones vinculadas, deberás desactivarlo.</AlertDialogDescription>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <AlertDialogCancel render={<Button ref={cancel} type="button" variant="outline" disabled={pending} />}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending || Boolean(error)} onClick={() => startTransition(async () => {
            try {
              const result = await deleteRecord({ kind, id });
              if (!result.ok) { setError(result.error || "No se pudo eliminar."); return; }
              setOpen(false); router.refresh();
            } catch { setError("No se pudo eliminar. Comprueba el listado antes de reintentar."); }
          })}>{pending ? "Eliminando…" : "Eliminar"}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
