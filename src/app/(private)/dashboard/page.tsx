import { requireBarbershopAccess, requireAuth, getCurrentMembership } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOperationalDashboard } from "@/lib/operational-dashboard";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireAuth();
  const membership = await getCurrentMembership();
  if (!membership) return <section className="space-y-6"><PageHeader title={`Bienvenido, ${user.name}`} description="Configura tu espacio de trabajo para comenzar." /><Button nativeButton={false} render={<Link href="/onboarding" />}>Crear mi barbería</Button></section>;
  const access = await requireBarbershopAccess();
  if (access.role !== "OWNER") return <section className="space-y-6"><PageHeader title={`Bienvenido, ${user.name}`} description="Este es el resumen de tu espacio de trabajo." /><div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Barbería</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{access.barbershop.name}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Rol actual</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{access.role}</CardContent></Card></div></section>;
  const now = new Date();
  const data = await getOperationalDashboard(prisma, access.barbershopId, access.barbershop.timezone, now);
  return <DashboardOverview data={data} timezone={access.barbershop.timezone} currency={access.barbershop.currency} now={now} />;
}
