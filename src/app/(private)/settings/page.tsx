import { MembershipRole } from "@prisma/client";
import { updateBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";
import { BusinessHoursDialog } from "@/components/settings/business-hours-dialog";
import { businessHoursSummary } from "@/lib/business-hours";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const membership = await requireRole(MembershipRole.OWNER); const { error, success } = await searchParams;
  const businessHours = await prisma.barbershopBusinessHour.findMany({ where: { barbershopId: membership.barbershopId } });
  return <section className="space-y-6"><PageHeader title="Configuración" description="Administra los datos generales de tu barbería." />{error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}<Card className="max-w-3xl"><CardHeader><CardTitle>Información de la barbería</CardTitle><CardDescription>Estos datos identifican tu espacio de trabajo.</CardDescription></CardHeader><CardContent><BarbershopForm action={updateBarbershop} defaults={membership.barbershop} submitLabel="Guardar cambios" /></CardContent></Card><Card className="max-w-3xl"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Horario de atención</CardTitle><CardDescription>Define el horario general de la barbería.</CardDescription></div><BusinessHoursDialog hours={businessHours} /></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{businessHoursSummary(businessHours).map((line) => <div key={line} className="text-sm text-muted-foreground">{line}</div>)}</div></CardContent></Card></section>;
}
