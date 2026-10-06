import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireBarbershopAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateService } from "@/app/actions/services";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { OperationFeedback } from "@/components/operation-feedback";
import { PublicImageUpload } from "@/components/public-image-upload";
import { PublicImage } from "@/components/public-image";
import { ServiceOnlineSettings } from "@/components/service-online-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const member = await requireBarbershopAccess();
  const { id } = await params;
  const { error, success } = await searchParams;
  const service = await prisma.service.findFirst({ where: { id, barbershopId: member.barbershopId }, include: { barberServices: { where: { barbershopId: member.barbershopId }, include: { barber: { select: { id: true, name: true, isActive: true } } } } } });
  if (!service) notFound();
  const owner = member.role === "OWNER";
  const barbers = owner ? await prisma.barber.findMany({ where: { barbershopId: member.barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: member.barbershop.currency });
  const policies = { NONE: "No requerir pago", OPTIONAL: "Pago opcional", FULL: "Pago completo", DEPOSIT: "Solicitar abono" };
  return <section className="space-y-6">
    <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/services" />}><ArrowLeft />Volver a servicios</Button>
    <PageHeader title={service.name} description={`${service.durationMinutes} min · ${money.format(Number(service.price))}`} />
    <StatusBadge active={service.isActive} />
    <OperationFeedback error={error} success={success} />
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Información</CardTitle>{owner && <Editor key={service.updatedAt.toISOString()} id={id} section="information" label="Editar información" title="Editar información" description="Actualiza los datos básicos del servicio.">
        <Field label="Nombre" id="service-name"><Input id="service-name" name="name" required maxLength={100} defaultValue={service.name} /></Field>
        <Field label="Descripción" id="service-description"><Textarea id="service-description" name="description" maxLength={500} defaultValue={service.description || ""} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Duración (min)" id="service-duration"><Input id="service-duration" name="durationMinutes" type="number" min="1" required defaultValue={service.durationMinutes} /></Field><Field label={`Precio (${member.barbershop.currency})`} id="service-price"><Input id="service-price" name="price" type="number" min="0" required defaultValue={service.price.toString()} /></Field></div>
        <input type="hidden" name="isActive" value="false" /><label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" value="true" defaultChecked={service.isActive} />Servicio activo</label>
      </Editor>}</CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2"><Detail label="Nombre">{service.name}</Detail><Detail label="Estado">{service.isActive ? "Activo" : "Inactivo"}</Detail><Detail label="Duración">{service.durationMinutes} min</Detail><Detail label="Precio">{money.format(Number(service.price))}</Detail><div className="sm:col-span-2"><Detail label="Descripción">{service.description || "Sin descripción"}</Detail></div></dl></CardContent></Card>
      <Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Profesionales</CardTitle>{owner && <Editor key={service.updatedAt.toISOString()} id={id} section="professionals" label="Editar profesionales" title="Profesionales" description="Selecciona quiénes pueden realizar este servicio.">
        {barbers.length ? barbers.map(barber => <label key={barber.id} className="flex items-center gap-2 text-sm"><Checkbox name="barberIds" value={barber.id} defaultChecked={service.barberServices.some(link => link.barberId === barber.id)} />{barber.name}</label>) : <p className="text-sm text-muted-foreground">No hay profesionales activos.</p>}
      </Editor>}</CardHeader><CardContent>{service.barberServices.length ? <ul className="space-y-3 text-sm">{service.barberServices.map(({ barber }) => <li key={barber.id}>{barber.name}{!barber.isActive && <span className="ml-2 text-xs text-muted-foreground">Inactivo</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Sin profesionales asignados.</p>}</CardContent></Card>
      <Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Reserva online</CardTitle>{owner && <Editor key={service.updatedAt.toISOString()} id={id} section="online" label="Editar configuración" title="Reserva online" description="Configura la disponibilidad pública del servicio."><ServiceOnlineSettings enabled={service.isOnlineBookingEnabled} policy={service.onlinePaymentPolicy} deposit={service.depositAmount?.toString()} /></Editor>}</CardHeader><CardContent><dl className="space-y-4"><Detail label="Disponible online">{service.isOnlineBookingEnabled ? "Sí" : "No"}</Detail><Detail label="Pago al reservar">{policies[service.onlinePaymentPolicy]}</Detail>{service.onlinePaymentPolicy === "DEPOSIT" && <Detail label="Monto del abono">{money.format(Number(service.depositAmount))}</Detail>}</dl>{service.onlinePaymentPolicy !== "NONE" && <p className="mt-4 text-xs text-muted-foreground">Pago online próximamente. Este servicio no se publicará hasta habilitar los pagos.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Imagen pública</CardTitle></CardHeader><CardContent>{owner ? <PublicImageUpload target="service" recordId={id} initialUrl={service.publicImageUrl} label="Imagen para reserva online" /> : <PublicImage src={service.publicImageUrl} alt={service.name} className="size-20 rounded-lg object-cover" fallback={<p className="text-sm text-muted-foreground">Sin imagen pública.</p>} />}</CardContent></Card>
    </div>
  </section>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{children}</dd></div>; }
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function Editor({ id, section, label, title, description, children }: { id: string; section: string; label: string; title: string; description: string; children: React.ReactNode }) {
  return <Dialog><DialogTrigger nativeButton render={<Button nativeButton variant="outline" size="sm" />}>{label}</DialogTrigger><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ width: "min(calc(100vw - 2rem), 28rem)" }}><form action={updateService}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="section" value={section} />
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-5">{children}</div>
    <DialogFooter><DialogClose nativeButton render={<Button nativeButton type="button" variant="outline" />}>Cancelar</DialogClose><Button type="submit">Guardar cambios</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
