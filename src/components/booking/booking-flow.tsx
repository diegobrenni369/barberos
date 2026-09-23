"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, Clock, UserRound } from "lucide-react";
import { es } from "react-day-picker/locale";
import { bookAppointment } from "@/app/actions/public-booking";
import { publicBookingInput, type BookingConfirmation } from "@/lib/public-booking-input";
import { calendarDate, civilDate } from "@/lib/agenda-navigation";
import { formatMoney } from "@/lib/cash";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type Service = { id: string; name: string; durationMinutes: number; price: string; barberIds: string[] };
type Props = { address: string | null; slug: string; currency: string; services: Service[]; barbers: { id: string; name: string }[]; today: string; lastDate: string; openDays: number[] };
const steps = ["Servicio", "Profesional", "Horario", "Tus datos", "Confirmar"];
const dateLabel = (date: string) => {
  const label = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(calendarDate(date));
  return label.charAt(0).toLocaleUpperCase("es-CL") + label.slice(1);
};
// Display only: uses the already selected service duration, never availability.
function timeRange(start: string, duration: number) {
  const [hour, minute] = start.split(":").map(Number);
  const end = hour * 60 + minute + duration;
  return `${start} – ${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function BookingFlow({ address, slug, currency, services, barbers, today, lastDate, openDays }: Props) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [slotState, setSlotState] = useState<{ key: string; slots: string[]; error?: string } | null>(null);
  const [refreshSlots, setRefreshSlots] = useState(0);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const service = services.find(item => item.id === serviceId);
  const eligibleBarbers = barbers.filter(item => service?.barberIds.includes(item.id));
  const barberName = barbers.find(item => item.id === barberId)?.name ?? "Cualquier barbero";
  const slotKey = JSON.stringify([slug, serviceId, barberId, date, refreshSlots]);
  const loading = Boolean(date) && slotState?.key !== slotKey;
  const slots = slotState?.key === slotKey ? slotState.slots : [];

  useEffect(() => {
    if (!date || !serviceId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ service: serviceId, date, ...(barberId ? { barber: barberId } : {}) });
    fetch(`/api/book/${encodeURIComponent(slug)}/slots?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No pudimos cargar los horarios.");
        if (!controller.signal.aborted) setSlotState({ key: slotKey, slots: data.slots });
      }).catch(error => {
        if (!controller.signal.aborted) setSlotState({ key: slotKey, slots: [], error: error instanceof Error ? error.message : "Intenta nuevamente." });
      });
    return () => controller.abort();
  }, [slug, serviceId, barberId, date, slotKey]);

  function payload() { return { slug, serviceId, barberId, date, time, name, phone, email }; }
  function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await bookAppointment(payload());
        if (result.ok) setConfirmation(result.confirmation);
        else { setError(result.error); setTime(""); setRefreshSlots(value => value + 1); setStep(2); }
      } catch { setError("No pudimos comprobar la confirmación. Revisa los horarios antes de reintentar."); setTime(""); setRefreshSlots(value => value + 1); setStep(2); }
      finally { submitting.current = false; }
    });
  }

  if (confirmation) return <Card className="border border-border ring-0"><CardContent className="space-y-6 py-3" role="status">
    <div className="space-y-3"><CheckCircle2 className="size-9 text-emerald-600" /><h2 className="text-2xl font-semibold tracking-tight">Tu reserva está confirmada</h2></div>
    <p className="break-words text-lg font-medium">{confirmation.service}</p>
    <div className="space-y-1"><p>{dateLabel(confirmation.date)}</p><p className="font-medium tabular-nums">{timeRange(confirmation.time, service?.durationMinutes ?? 0)}</p></div>
    <p className="break-words">{confirmation.barber}</p>
    <div className="space-y-1"><p className="font-medium">{confirmation.shop}</p>{address && <p className="break-words text-sm text-muted-foreground">{address}</p>}</div>
    <Separator /><div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">Pago en la barbería</span>{service && <span className="font-medium tabular-nums">{formatMoney(service.price, currency)}</span>}</div>
  </CardContent></Card>;
  if (!services.length || !barbers.length || !openDays.length) return <Card><CardContent className="space-y-2"><h2 className="font-medium">Reserva online no disponible</h2><p className="text-sm text-muted-foreground">La barbería todavía no tiene servicios u horarios disponibles para reservar online.</p></CardContent></Card>;

  return <div className="space-y-4">
    <div className="space-y-2" aria-label="Progreso de la reserva">
      <p className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Paso {step + 1} de {steps.length}</span><span className="font-medium">{steps[step]}</span></p>
      <div role="progressbar" aria-label="Progreso de la reserva" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-valuetext={`Paso ${step + 1} de ${steps.length}: ${steps[step]}`} className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/40" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
    <Card className="border border-border ring-0"><CardContent className="space-y-6">
      {step > 0 && <Button type="button" variant="ghost" className="min-h-11 -ml-2" disabled={pending} onClick={() => { setStep(value => value - 1); setError(""); }}><ChevronLeft />Volver</Button>}
      {error && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {step === 0 && <section className="space-y-3"><h2 className="text-lg font-medium">¿Qué servicio necesitas?</h2>{services.map(item => <Button key={item.id} type="button" variant="outline" aria-pressed={serviceId === item.id} className={`h-auto min-h-20 w-full justify-between gap-4 whitespace-normal px-4 py-3 text-left hover:bg-muted/50 ${serviceId === item.id ? "border-foreground/40 bg-muted/60" : ""}`} onClick={() => { if (serviceId !== item.id) { setServiceId(item.id); setTime(""); if (barberId && !item.barberIds.includes(barberId)) setBarberId(null); } setStep(1); }}><span className="min-w-0"><span className="block break-words">{item.name}</span><span className="mt-1 flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock className="size-3" />{item.durationMinutes} min</span></span><span className="shrink-0 tabular-nums">{formatMoney(item.price, currency)}</span></Button>)}</section>}
      {step === 1 && <section className="space-y-3"><h2 className="text-lg font-medium">¿Con quién quieres atenderte?</h2>{[{ id: null, name: "Cualquier barbero" }, ...eligibleBarbers].map(item => <Button key={item.id ?? "any"} type="button" variant="outline" aria-pressed={barberId === item.id} className={`h-auto min-h-14 w-full justify-start whitespace-normal px-4 py-3 hover:bg-muted/50 ${barberId === item.id ? "border-foreground/40 bg-muted/60" : ""}`} onClick={() => { if (barberId !== item.id) setTime(""); setBarberId(item.id); setStep(2); }}><UserRound /><span className="min-w-0 break-words">{item.name}</span></Button>)}</section>}
      {step === 2 && <section className="space-y-4"><h2 className="text-lg font-medium">Elige fecha y hora</h2><div className="flex justify-center"><Calendar mode="single" locale={es} weekStartsOn={1} today={calendarDate(today)} defaultMonth={calendarDate(date || today)} selected={date ? calendarDate(date) : undefined} startMonth={calendarDate(today)} endMonth={calendarDate(lastDate)} disabled={value => civilDate(value) < today || civilDate(value) > lastDate || !openDays.includes(value.getDay())} onSelect={value => { if (value) { setDate(civilDate(value)); setTime(""); } }} className="max-w-full p-0 [--cell-size:2.5rem]" /></div>
        {date && <><Separator /><h3 className="text-sm font-medium">Horarios disponibles</h3><div aria-live="polite">{loading ? <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(value => <Skeleton key={value} className="h-11" />)}</div> : slotState?.error ? <div className="space-y-2"><p className="text-sm text-muted-foreground">{slotState.error}</p><Button variant="outline" className="min-h-11" onClick={() => setRefreshSlots(value => value + 1)}>Reintentar</Button></div> : slots.length ? <div className="space-y-4">{["Mañana", "Tarde"].map((period, index) => {
          const periodSlots = slots.filter(slot => (Number(slot.slice(0, 2)) < 12) === (index === 0));
          return periodSlots.length > 0 && <section key={period} className="space-y-2" aria-label={period}><h4 className="text-xs text-muted-foreground">{period}</h4><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{periodSlots.map(slot => <Button type="button" key={slot} variant={time === slot ? "default" : "outline"} aria-pressed={time === slot} className="min-h-11 tabular-nums" onClick={() => setTime(slot)}>{slot}</Button>)}</div></section>;
        })}</div> : <p className="text-sm text-muted-foreground">No hay horarios disponibles para este día. Elige otra fecha.</p>}</div></>}
        <Button type="button" className="min-h-11 w-full" disabled={!time || loading || !slots.includes(time)} onClick={() => { setError(""); setStep(3); }}>Continuar</Button>
      </section>}
      {step === 3 && <form className="space-y-4" onSubmit={event => { event.preventDefault(); const parsed = publicBookingInput.safeParse(payload()); if (!parsed.success) { setError(parsed.error.issues[0].message); return; } setError(""); setStep(4); }}><h2 className="text-lg font-medium">Tus datos</h2><div className="grid gap-2"><Label htmlFor="booking-name">Nombre</Label><Input id="booking-name" autoComplete="name" required minLength={2} maxLength={100} className="h-11" value={name} onChange={event => setName(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="booking-phone">Teléfono</Label><Input id="booking-phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="+56 9 1234 5678" className="h-11" value={phone} onChange={event => setPhone(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="booking-email">Email <span className="text-muted-foreground">(opcional)</span></Label><Input id="booking-email" type="email" autoComplete="email" maxLength={254} className="h-11" value={email} onChange={event => setEmail(event.target.value)} /></div><Button type="submit" className="min-h-11 w-full">Revisar reserva</Button></form>}
      {step === 4 && service && <section className="space-y-4"><h2 className="text-lg font-medium">Confirma tu reserva</h2><div className="space-y-1"><p className="font-medium">{service.name}</p><p className="text-sm text-muted-foreground">{service.durationMinutes} min · {formatMoney(service.price, currency)}</p></div><Separator /><div className="space-y-3 text-sm"><div className="space-y-1"><p>{dateLabel(date)}</p><p className="font-medium tabular-nums">{timeRange(time, service.durationMinutes)}</p></div><p>{barberName}</p></div><Separator /><div className="space-y-1 text-sm"><p className="break-words font-medium">{name}</p><p className="text-muted-foreground">{phone}</p></div><Separator /><div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">Pago en la barbería</span><span className="font-medium tabular-nums">{formatMoney(service.price, currency)}</span></div><Button type="button" className="min-h-11 w-full" disabled={pending} onClick={confirm}>{pending ? "Confirmando…" : "Confirmar reserva"}</Button></section>}
    </CardContent></Card>
  </div>;
}
