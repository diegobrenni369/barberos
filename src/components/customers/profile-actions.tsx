"use client";

import { useState } from "react";
import { AppointmentDialog, type AgendaOption, type ServiceOption } from "@/components/agenda/appointment-dialog";
import { appointmentStatusStyles } from "@/components/agenda/appointment-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppointmentStatusBadge({ status }: { status: string }) {
  const style = appointmentStatusStyles[status];
  return <Badge variant="outline" className="font-normal text-muted-foreground"><span aria-hidden className={`size-1.5 rounded-full ${style?.indicator}`} />{style?.label ?? status}</Badge>;
}

export function CustomerBooking({ customer, barbers, services, date }: { customer: AgendaOption; barbers: AgendaOption[]; services: ServiceOption[]; date: string }) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>Crear reserva</Button>{open && <AppointmentDialog open={open} onOpenChange={setOpen} customers={[customer]} barbers={barbers} services={services} defaults={{ date, time: "09:00" }} />}</>;
}
