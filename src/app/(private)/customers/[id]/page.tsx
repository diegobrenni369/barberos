import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { updateCustomer } from "@/app/actions/customers";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { AppointmentStatusBadge, CustomerBooking } from "@/components/customers/profile-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { requireBarbershopAccess } from "@/lib/auth";
import { utcToZonedParts } from "@/lib/agenda";
import { formatMoney } from "@/lib/cash";
import { getCustomerProfile } from "@/lib/customer-profile";
import { prisma } from "@/lib/prisma";

export default async function CustomerProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const membership = await requireBarbershopAccess();
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();
  const profile = await getCustomerProfile(prisma, membership.barbershopId, id, Number(query.page ?? 1), now);
  if (!profile) notFound();
  const { customer, counts, next } = profile;
  const { timezone, currency } = membership.barbershop;
  const date = (value: Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => new Intl.DateTimeFormat("es-CL", { ...options, timeZone: timezone }).format(value);
  const time = (value: Date) => utcToZonedParts(value, timezone).time;
  const [barbers, services] = customer.isActive ? await Promise.all([
    prisma.barber.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, select: { id: true, name: true, price: true, durationMinutes: true, barberServices: { where: { barbershopId: membership.barbershopId, barber: { isActive: true } }, select: { barberId: true } } }, orderBy: { name: "asc" } }),
  ]) : [[], []];
  const booking = customer.isActive ? <CustomerBooking customer={{ id, name: customer.name }} date={utcToZonedParts(now, timezone).date} barbers={barbers} services={services.map(({ barberServices, ...service }) => ({ ...service, price: service.price.toString(), barberIds: barberServices.map(link => link.barberId) }))} /> : <p className="text-xs text-muted-foreground">Activa al cliente para crear una reserva.</p>;
  return <section className="space-y-6">
    <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/customers" />}><ArrowLeft />Volver a clientes</Button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2"><h1 className="break-words text-2xl font-semibold tracking-tight">{customer.name}</h1><StatusBadge active={customer.isActive} /><div className="break-words text-sm text-muted-foreground"><p>{customer.phone || "Sin teléfono"}</p><p>{customer.email || "Sin email"}</p></div><p className="text-xs text-muted-foreground">Cliente desde {date(customer.createdAt, { month: "long", year: "numeric" })}</p></div>
      {membership.role === "OWNER" && <CustomerDialog customer={customer} action={updateCustomer} trigger="Editar cliente" />}
    </header>
    <Card size="sm"><CardContent><dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">{[
      ["Atenciones", counts.COMPLETED ?? 0], ["Gastado", formatMoney(profile.total.toString(), currency)], ["Ticket promedio", formatMoney(profile.average.toString(), currency)], ["Última visita", profile.lastVisit ? date(profile.lastVisit) : "Sin última visita"],
    ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd></div>)}</dl></CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Próxima reserva</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">{next ? <><div><p className="font-medium">{date(next.startsAt, { weekday: "long", day: "numeric", month: "long" })}</p><p className="tabular-nums">{time(next.startsAt)}–{time(next.endsAt)}</p></div><div><p>{next.service.name}</p><p className="text-muted-foreground">{next.barber.name}</p></div><AppointmentStatusBadge status={next.status} /><div><Button nativeButton={false} variant="outline" render={<Link href={`/agenda?date=${utcToZonedParts(next.startsAt, timezone).date}`} />}>Ver en Agenda</Button></div></> : <><p className="text-muted-foreground">Sin próximas reservas</p>{booking}</>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Preferencias habituales</CardTitle></CardHeader><CardContent><dl className="space-y-4 text-sm">{[["Servicio frecuente", profile.frequentService], ["Barbero frecuente", profile.frequentBarber]].map(([label, value]) => { const item = typeof value === "object" ? value : null; return <div key={String(label)}><dt className="text-xs text-muted-foreground">{String(label)}</dt><dd className="mt-1">{item ? <>{item.name}<span className="ml-2 text-xs text-muted-foreground">{item.count} atenciones</span></> : "Sin atenciones completadas"}</dd></div>; })}</dl></CardContent></Card>
    </div>
    <section className="space-y-3" aria-labelledby="history-title"><h2 id="history-title" className="font-semibold">Historial</h2><div className="divide-y rounded-xl border border-border bg-card">{profile.history.length ? profile.history.map(appointment => {
      const sale = appointment.sale?.status === "COMPLETED" ? appointment.sale : null;
      return <article key={appointment.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_2fr_1fr] sm:items-center text-sm"><div><p className="font-medium">{date(appointment.startsAt)}</p><p className="text-xs tabular-nums text-muted-foreground">{time(appointment.startsAt)}–{time(appointment.endsAt)}</p></div><div className="min-w-0"><p className="break-words">{sale?.items.length ? sale.items.map(item => item.description).join(" · ") : appointment.service.name}</p><p className="text-xs text-muted-foreground">{appointment.barber.name}</p></div><div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end"><AppointmentStatusBadge status={appointment.status} /><span className="tabular-nums">{sale ? formatMoney(sale.total.toString(), sale.currency) : "—"}</span></div></article>;
    }) : <p className="p-5 text-sm text-muted-foreground">Este cliente todavía no tiene atenciones registradas.</p>}</div><p className="text-xs text-muted-foreground">Importes de ventas válidas, no precios actuales de servicios.</p>{profile.pages > 1 && <nav aria-label="Paginación del historial" className="flex items-center justify-between gap-3 text-sm">{profile.page > 1 ? <Link className="underline underline-offset-4" href={`?page=${profile.page - 1}`}>Anterior</Link> : <span />}<span className="text-muted-foreground">Página {profile.page} de {profile.pages}</span>{profile.page < profile.pages ? <Link className="underline underline-offset-4" href={`?page=${profile.page + 1}`}>Ver más</Link> : <span />}</nav>}</section>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Comportamiento</CardTitle></CardHeader><CardContent><dl className="space-y-3 text-sm">{[["Completadas", counts.COMPLETED], ["Canceladas", counts.CANCELLED], ["No asistió", counts.NO_SHOW]].map(([label, count]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{count ?? 0}</dd></div>)}</dl></CardContent></Card><Card><CardHeader><CardTitle>Notas internas</CardTitle></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{customer.notes || "Sin notas sobre este cliente."}</p>{membership.role === "OWNER" && <CustomerDialog customer={customer} action={updateCustomer} trigger="Editar notas" />}</CardContent></Card></div>
  </section>;
}
