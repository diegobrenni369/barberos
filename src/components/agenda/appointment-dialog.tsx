"use client";

import { useState } from "react";
import {
  createAppointment,
  restoreAppointment,
  updateAppointment,
} from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type AgendaOption = { id: string; name: string };
export type ServiceOption = AgendaOption & {
  barberIds: string[];
  durationMinutes: number;
  price: string;
};
export type AppointmentData = {
  id: string;
  barberId: string;
  customerId: string;
  serviceId: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  customerName: string;
  serviceName: string;
  endTime: string;
  price: string;
  updatedAt: string;
  durationMinutes: number;
  currency: string;
  canCharge?: boolean;
  sale?: { total: string; currency: string; method: import("@/lib/cash").CashPaymentMethod | null; status: string; paymentLabel: string } | null;
};

export const statuses = [
  { value: "SCHEDULED", label: "Agendada" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "NO_SHOW", label: "No asistió" },
];

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  defaults,
  barbers,
  customers,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: AppointmentData;
  defaults: { date: string; time: string; barberId?: string };
  barbers: AgendaOption[];
  customers: AgendaOption[];
  services: ServiceOption[];
}) {
  const [barberId, setBarberId] = useState(
    appointment?.barberId ?? defaults.barberId ?? barbers[0]?.id ?? "",
  );
  const [customerId, setCustomerId] = useState(
    appointment?.customerId ?? customers[0]?.id ?? "",
  );
  const [serviceId, setServiceId] = useState(
    appointment?.serviceId ?? services[0]?.id ?? "",
  );
  const [status, setStatus] = useState(appointment?.status ?? "SCHEDULED");
  const [time, setTime] = useState(appointment?.time ?? defaults.time);
  const service = services.find((item) => item.id === serviceId);
  const eligibleBarbers = barbers.filter(item => service?.barberIds.includes(item.id));
  const eligibleBarberId = eligibleBarbers.some(item => item.id === barberId) ? barberId : "";
  const durationMinutes = service?.durationMinutes ?? 0;
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  const endTime = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  const money = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
  const action = appointment ? updateAppointment : createAppointment;
  const customerName = customers.find((item) => item.id === customerId)?.name;
  const barberName = eligibleBarbers.find((item) => item.id === eligibleBarberId)?.name;
  const statusName = statuses.find((item) => item.value === status)?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>
              {appointment ? "Editar reserva" : "Nueva reserva"}
            </DialogTitle>
            <DialogDescription>
              {appointment
                ? "Actualiza los datos o el estado de la reserva."
                : "Agenda una atención para un cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <input type="hidden" name="id" value={appointment?.id ?? ""} />
            <input type="hidden" name="barberId" value={eligibleBarberId} />
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="serviceId" value={serviceId} />
            <input type="hidden" name="status" value={status} />
            <Field label="Cliente">
              <Select
                value={customerId}
                onValueChange={(value) => setCustomerId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un cliente">
                    {customerName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Servicio">
                <Select
                  value={serviceId}
                  onValueChange={(value) => {
                    setServiceId(value ?? "");
                    if (!services.find(item => item.id === value)?.barberIds.includes(barberId)) setBarberId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un servicio">
                      {service?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Barbero">
                <Select
                  value={eligibleBarberId}
                  onValueChange={(value) => setBarberId(value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un barbero">
                      {barberName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleBarbers.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {!eligibleBarberId && <p className="text-xs text-muted-foreground">Selecciona un profesional que realice este servicio.{eligibleBarbers.length === 0 ? " Configura los profesionales en Servicios." : ""}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <Input
                  type="date"
                  name="date"
                  required
                  defaultValue={appointment?.date ?? defaults.date}
                />
              </Field>
              <Field label="Hora">
                <Input
                  type="time"
                  name="time"
                  required
                  step="300"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </Field>
            </div>
            {appointment && (
              <Field label="Estado">
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value ?? "SCHEDULED")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{statusName}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.filter(item => item.value !== "COMPLETED" || appointment?.status === "COMPLETED").map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Notas">
              <Textarea
                name="notes"
                rows={3}
                defaultValue={appointment?.notes ?? ""}
              />
            </Field>
            {service && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">{service.name}</div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>
                    {service.durationMinutes} min ·{" "}
                    {money.format(Number(service.price))}
                  </span>
                  <span>
                    {time} → {endTime}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              nativeButton
              render={<Button nativeButton type="button" variant="outline" />}
            >
              Cancelar
            </DialogClose>
            {appointment?.status === "CANCELLED" && (
              <Button
                type="submit"
                variant="outline"
                formAction={restoreAppointment}
              >
                Restaurar reserva
              </Button>
            )}
            <Button
              type="submit"
              disabled={!eligibleBarberId || !customerId || !serviceId}
            >
              Guardar reserva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
