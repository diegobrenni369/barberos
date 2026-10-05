"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicImage } from "@/components/public-image";
import { MAX_PUBLIC_IMAGE_BYTES, PUBLIC_IMAGE_TYPES, type ImageTarget } from "@/lib/public-branding";

export function PublicImageUpload({ target, recordId, initialUrl, label }: { target: ImageTarget; recordId?: string; initialUrl: string | null; label: string }) {
  const inputId = useId();
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function upload(file: File | null) {
    if (busy) return;
    setError(false); setMessage("");
    if (file && (!PUBLIC_IMAGE_TYPES.includes(file.type) || file.size > MAX_PUBLIC_IMAGE_BYTES)) { setError(true); setMessage("Usa JPEG, PNG o WebP de hasta 3 MB."); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams({ target, ...(recordId ? { id: recordId } : {}) });
      const response = await fetch(`/api/public-images?${params}`, { method: "POST", headers: file ? { "Content-Type": file.type } : { "x-remove-image": "true" }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la imagen.");
      setUrl(result.url); setMessage(file ? "Imagen guardada." : "Imagen quitada."); router.refresh();
    } catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "No se pudo subir la imagen."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={inputId}>{label}</Label>
    <PublicImage src={url} alt={label} className={target === "cover" ? "h-24 w-full max-w-xs rounded-lg object-cover" : "size-16 rounded-lg object-cover"} />
    <Input id={inputId} type="file" accept={PUBLIC_IMAGE_TYPES.join(",")} disabled={busy} className="w-full min-w-0" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
    <p className="text-xs text-muted-foreground">JPEG, PNG o WebP · máximo 3 MB. Se guarda inmediatamente.</p>
    {url && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void upload(null)}>Quitar imagen</Button>}
    {busy && <p role="status" className="text-xs text-muted-foreground">Guardando imagen…</p>}
    {message && <p role={error ? "alert" : "status"} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{message}</p>}
  </div>;
}
