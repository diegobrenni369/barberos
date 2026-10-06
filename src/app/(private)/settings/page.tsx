import { OperationFeedback } from "@/components/operation-feedback";
import { PublicSiteSettings } from "@/components/settings/public-site-settings";
import { MembershipRole } from "@prisma/client";
import { updateBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";
import { BusinessHoursDialog } from "@/components/settings/business-hours-dialog";
import { businessHoursSummary } from "@/lib/business-hours";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const membership = await requireRole(MembershipRole.OWNER); const { error, success } = await searchParams;
  const businessHours = await prisma.barbershopBusinessHour.findMany({ where: { barbershopId: membership.barbershopId } });
  const shop = membership.barbershop;
  const details = [
    ["Nombre", shop.name],
    ["Teléfono", shop.phone],
    ["Email", shop.email],
    ["Dirección", shop.address],
    ["Zona horaria", shop.timezone],
    ["Moneda", shop.currency],
  ];
  return <section className="space-y-6">
    <PageHeader title="Configuración" description="Administra los datos generales de tu barbería." />
    <OperationFeedback error={error} success={success} />
    <Tabs defaultValue="general" className="max-w-3xl">
      <TabsList aria-label="Secciones de configuración" className="max-w-full">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="hours">Horarios</TabsTrigger>
        <TabsTrigger value="public">Sitio público</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1"><CardTitle>Información de la barbería</CardTitle><CardDescription>Los datos de tu espacio de trabajo.</CardDescription></div>
            <Dialog key={shop.updatedAt.toISOString()}>
              <DialogTrigger nativeButton render={<Button nativeButton variant="outline" size="sm" />}>Editar</DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ width: "min(calc(100vw - 2rem), 32rem)" }}>
                <DialogHeader><DialogTitle>Editar barbería</DialogTitle><DialogDescription>Actualiza los datos generales de tu barbería.</DialogDescription></DialogHeader>
                <BarbershopForm action={updateBarbershop} defaults={shop} submitLabel="Guardar cambios" />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {details.map(([label, value]) => <div key={label} className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{value || "Sin registrar"}</dd></div>)}
            </dl>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="hours">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Horario de atención</CardTitle><CardDescription>Define el horario general de la barbería.</CardDescription></div><BusinessHoursDialog hours={businessHours} /></CardHeader>
          <CardContent><div className="grid gap-2 sm:grid-cols-2">{businessHoursSummary(businessHours).map((line) => <div key={line} className="text-sm text-muted-foreground">{line}</div>)}</div></CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="public"><PublicSiteSettings shop={shop} /></TabsContent>
    </Tabs>
  </section>;
}
