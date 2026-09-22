import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BarberHoursSummary } from "@/components/barbers/barber-hours-summary";
import { BarberScheduleDialog } from "@/components/barbers/barber-schedule-dialog";
import { BarberBlocksPanel } from "@/components/barbers/barber-blocks-panel";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBarbershopAccess } from "@/lib/auth";
import { utcToZonedParts } from "@/lib/agenda";
import { prisma } from "@/lib/prisma";

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireBarbershopAccess(); const { id } = await params;
  const [barber, businessHours, reasons] = await Promise.all([
    prisma.barber.findFirst({ where: { id, barbershopId: membership.barbershopId }, include: { availabilities: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] }, breaks: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] }, blocks: { where: { endsAt: { gte: new Date() } }, include: { reason: true }, orderBy: { startsAt: "asc" }, take: 20 } } }),
    prisma.barbershopBusinessHour.findMany({ where: { barbershopId: membership.barbershopId } }),
    prisma.blockReason.findMany({ where: { barbershopId: membership.barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!barber) notFound();
  const blocks = barber.blocks.map((block) => { const start = utcToZonedParts(block.startsAt, membership.barbershop.timezone); const end = utcToZonedParts(block.endsAt, membership.barbershop.timezone); return { id: block.id, barberId: barber.id, date: start.date, startTime: start.time, endTime: end.time, allDay: start.time === "00:00" && end.date !== start.date, reasonId: block.reasonId, reasonName: block.reason.name, note: block.note ?? "" }; });
  return <section className="space-y-6">
    <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/barbers" />}><ArrowLeft />Volver a barberos</Button>
    <PageHeader title={barber.name} description="Perfil, disponibilidad y excepciones del barbero." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Resumen</CardTitle><CardDescription>Información operativa del integrante.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm"><Detail label="Estado"><StatusBadge active={barber.isActive} /></Detail><Detail label="Teléfono">{barber.phone || "—"}</Detail><Detail label="Email">{barber.email || "—"}</Detail><Detail label="Comisión">{barber.commissionRate.toString()}%</Detail></CardContent></Card>
      <Card><CardHeader className="flex flex-col items-start justify-between gap-4 xl:flex-row"><div><CardTitle>Horario semanal</CardTitle><CardDescription>{barber.availabilities.length ? "Horario personalizado" : "Usa el horario de la barbería"}</CardDescription></div>{membership.role === "OWNER" && <BarberScheduleDialog barber={{ id: barber.id, name: barber.name }} availability={barber.availabilities} breaks={barber.breaks} businessHours={businessHours} />}</CardHeader><CardContent><BarberHoursSummary availability={barber.availabilities} breaks={barber.breaks} businessHours={businessHours} /></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Próximos bloqueos</CardTitle><CardDescription>Ausencias y excepciones puntuales registradas desde Agenda.</CardDescription></CardHeader><CardContent><BarberBlocksPanel barber={{ id: barber.id, name: barber.name }} blocks={blocks} reasons={reasons} /></CardContent></Card>
  </section>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span>{children}</span></div>; }
