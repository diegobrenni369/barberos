"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Keep validation beside forms; only operational failures leave the page layout.
export function OperationFeedback({ error, success, operation = false }: { error?: string; success?: string; operation?: boolean }) {
  const shown = useRef("");
  const query = useSearchParams().toString();
  const isOperation = operation || /no (?:se )?(?:pudo|pudimos|puede|encontr)|ocupado|conflicto|no está disponible|no realiza|actividad registrada|cambió|reservas activas|fuera (?:del|de la)|bloqueo|bloqueado|descanso|está cerrada|venta registrada|Usa Cobrar|no fue encontrada/i.test(error || "");
  const safeError = error && /prisma|stack|\bat \S+|P\d{4}|SQLSTATE|invocation/i.test(error) ? "No se pudo completar la operación." : error;
  useEffect(() => {
    const params = new URLSearchParams(query);
    if (params.get("error") !== error && params.get("success") !== success) { shown.current = ""; return; }
    const key = `${error || ""}|${success || ""}`;
    if (shown.current === key) return;
    shown.current = key;
    if (safeError && isOperation) {
      if (/no realiza este servicio/i.test(safeError)) toast.warning("Este profesional no realiza este servicio.");
      else toast.error(/^Ese horario ya está ocupado/.test(safeError) ? "Ese horario ya está ocupado." : safeError);
    } else if (success) toast.success(success);
    if ((safeError && isOperation) || success) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("error") === error) url.searchParams.delete("error");
      if (url.searchParams.get("success") === success) url.searchParams.delete("success");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [error, success, safeError, isOperation, query]);
  return safeError && !isOperation ? <p role="alert" className="text-sm text-destructive">{safeError}</p> : null;
}
