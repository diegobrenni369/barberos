"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return <Sonner richColors closeButton position="bottom-right" visibleToasts={3}
    containerAriaLabel="Notificaciones" toastOptions={{ className: "font-sans", duration: 5000, closeButtonAriaLabel: "Cerrar notificación" }} />;
}
