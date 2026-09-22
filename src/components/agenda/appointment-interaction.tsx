"use client";

import { useRef, useState } from "react";
import { useDraggable, useDragDropMonitor, useDragOperation } from "@dnd-kit/react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AppointmentCard } from "./appointment-card";
import { AppointmentDetails } from "./appointment-details";
import type { AppointmentData } from "./appointment-dialog";
import { useAppointmentDragPending } from "./appointment-drag";

export function AppointmentInteraction({ appointment, barberName, gridStartMinute, onClick, suppressHover = false }: { appointment: AppointmentData; barberName: string; gridStartMinute: number; onClick: () => void; suppressHover?: boolean }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const mouse = useRef(false);
  const suppressClickUntil = useRef(0);
  const pending = useAppointmentDragPending();
  const { source } = useDragOperation();
  const { ref } = useDraggable({ id: appointment.id, disabled: pending || !["SCHEDULED", "CONFIRMED"].includes(appointment.status) });
  useDragDropMonitor({
    onDragStart: () => { setHoverOpen(false); suppressClickUntil.current = Infinity; },
    onDragEnd: () => { suppressClickUntil.current = Date.now() + 200; },
  });
  return <HoverCard open={hoverOpen && !suppressHover && !source && !pending} onOpenChange={open => setHoverOpen(open && !suppressHover && mouse.current && !source && !pending)}>
    <HoverCardTrigger delay={550} closeDelay={150} render={<AppointmentCard
      ref={ref}
      appointment={appointment}
      gridStartMinute={gridStartMinute}
      onPointerEnter={event => { mouse.current = event.pointerType === "mouse"; }}
      onPointerDown={event => { if (event.pointerType !== "mouse") { mouse.current = false; setHoverOpen(false); } }}
      onClick={() => { if (pending || Date.now() < suppressClickUntil.current) return; setHoverOpen(false); onClick(); }}
      aria-label={`${appointment.customerName}, ${appointment.serviceName}, ${appointment.time}–${appointment.endTime}. Ver reserva`}
    />} />
    <HoverCardContent side="right" align="start" className="w-72 p-4"><AppointmentDetails appointment={appointment} barberName={barberName} /></HoverCardContent>
  </HoverCard>;
}
