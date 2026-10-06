"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MobileAccessFields() {
  const [enabled, setEnabled] = useState(false);
  const id = useId();
  return <div className="grid gap-3 border-t pt-3">
    <div className="flex items-center gap-2"><Checkbox id={id} checked={enabled} onCheckedChange={value => setEnabled(value === true)} /><Label htmlFor={id}>Dar acceso a BarberOS Mobile</Label></div>
    {enabled && <>
      <input type="hidden" name="mobileAccess" value="on" />
      <div className="grid gap-2"><Label htmlFor={`${id}-email`}>Email de acceso</Label><Input id={`${id}-email`} name="accessEmail" type="email" required autoComplete="off" /></div>
      <div className="grid gap-2"><Label htmlFor={`${id}-password`}>Contraseña inicial</Label><Input id={`${id}-password`} name="accessPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></div>
      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Si el usuario ya existe, conserva su contraseña actual.</p>
    </>}
  </div>;
}
