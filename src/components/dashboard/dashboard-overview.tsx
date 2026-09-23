import Link from "next/link";
import type { getOperationalDashboard } from "@/lib/operational-dashboard";
import { utcToZonedParts } from "@/lib/agenda";
import { formatMoney } from "@/lib/cash";
import { PageHeader } from "@/components/page-header";
import { AppointmentStatusBadge } from "@/components/customers/profile-actions";
import { SalesTrend } from "./sales-trend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardOverview({ data, timezone, currency, now }: { data: Awaited<ReturnType<typeof getOperationalDashboard>>; timezone: string; currency: string; now: Date }) {
  const money = (value: { toString(): string }) => formatMoney(value.toString(), currency);
  const time = (value: Date) => utcToZonedParts(value, timezone).time;
  const label = new Intl.DateTimeFormat("es-CL", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const maxSales = data.trend.reduce((max, day) => day.sales.gt(max) ? day.sales : max, data.total);
  const trend = data.trend.map(day => ({ date: day.date, completed: day.completed, dateLabel: new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day.date}T12:00:00Z`)), salesLabel: money(day.sales), height: maxSales.isZero() ? 0 : day.sales.div(maxSales).times(100).toNumber() }));
  const nextId = data.dailyAgenda.find(item => item.startsAt >= now && item.status !== "COMPLETED")?.id;
  return <section className="space-y-6">
    <PageHeader title="Dashboard" description={`Hoy · ${label}`} action={<Button variant="outline" nativeButton={false} render={<Link href={`/agenda?date=${data.today}`} />}>Ver agenda</Button>} />
    <Card size="sm"><CardContent>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        <Metric label="Reservas" value={data.counts.reservations} hint={`${data.counts.active} activas`} />
        <Metric label="Ventas" value={money(data.total)} hint={`${data.saleCount} ventas válidas`} />
        <Metric label="Atenciones" value={data.counts.completed} hint="Completadas" />
        <Metric label="Ticket promedio" value={money(data.average)} hint="Por venta válida" />
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground"><span>Canceladas <strong className="ml-1 font-medium text-foreground">{data.counts.cancelled}</strong></span><span>No asistió <strong className="ml-1 font-medium text-foreground">{data.counts.noShow}</strong></span></div>
    </CardContent></Card>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Agenda de hoy</CardTitle></CardHeader><CardContent>
        {data.dailyAgenda.length ? <ul className="divide-y divide-border">{data.dailyAgenda.map(item => <li key={item.id} className={`flex items-start gap-3 py-3 first:pt-0 last:pb-0 ${item.status === "COMPLETED" || item.startsAt < now ? "opacity-70" : ""} ${item.id === nextId ? "bg-muted/30" : ""}`}><span className="pt-0.5 text-sm font-medium tabular-nums">{time(item.startsAt)}</span><div className="min-w-0 flex-1 space-y-1"><p className="truncate text-sm font-medium">{item.customer.name}</p><p className="truncate text-xs text-muted-foreground">{item.service.name} · {item.barber.name}</p><AppointmentStatusBadge status={item.status} /></div></li>)}</ul> : <p className="text-sm text-muted-foreground">{"No hay próximas reservas ni atenciones completadas para mostrar."}</p>}
        {data.remainingAgendaCount > 0 && <Link href={`/agenda?date=${data.today}`} className="mt-4 inline-block text-sm underline underline-offset-4">Ver {data.remainingAgendaCount} más en Agenda</Link>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Equipo hoy</CardTitle></CardHeader><CardContent>
        {data.team.length ? <ul className="max-h-96 divide-y divide-border overflow-y-auto">{data.team.map(member => <li key={member.id} className="space-y-1 py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-3 text-sm"><Link href={`/barbers/${member.id}`} className="min-w-0 truncate font-medium hover:underline">{member.name}</Link><span className="shrink-0 tabular-nums">{money(member.sales)}</span></div><div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{member.completed} atenciones</span><span>{member.next ? `Próxima ${time(member.next)}` : "Sin próximas reservas"}</span></div></li>)}</ul> : <p className="text-sm text-muted-foreground">No hay barberos activos.</p>}
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Ventas últimos 7 días</CardTitle></CardHeader><CardContent><SalesTrend days={trend} /></CardContent></Card>
  </section>;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</dd><dd className="mt-1 text-xs text-muted-foreground">{hint}</dd></div>;
}
