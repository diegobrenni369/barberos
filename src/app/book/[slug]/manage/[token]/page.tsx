import { prisma } from "@/lib/prisma";
import { findPublicAppointment } from "@/lib/appointment-reminders";
import { utcToZonedParts } from "@/lib/agenda";
import { ManageAppointment } from "@/components/booking/manage-appointment";
import { headers } from "next/headers";
import { allowPublicRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu reserva | BarberOS", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ManagePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!await allowPublicRequest(prisma, await headers(), "manage")) return <main className="mx-auto max-w-lg p-6"><h1 className="text-xl font-semibold">Espera un momento</h1><p>Demasiadas consultas. Vuelve a intentar en un minuto.</p></main>;
  const appointment = await findPublicAppointment(prisma, slug, token);
  const date = appointment ? new Intl.DateTimeFormat("es-CL", { timeZone: appointment.barbershop.timezone, weekday: "long", day: "numeric", month: "long" }).format(appointment.startsAt) : "";
  const time = appointment ? `${utcToZonedParts(appointment.startsAt, appointment.barbershop.timezone).time} – ${utcToZonedParts(appointment.endsAt, appointment.barbershop.timezone).time}` : "";
  return <main lang="es" className="min-h-dvh bg-muted/20 px-4 py-8 sm:py-12"><div className="mx-auto w-full max-w-lg space-y-6">
    <h1 className="text-3xl font-semibold tracking-tight">Tu reserva</h1>
    <section className="space-y-5 rounded-xl border border-border bg-background p-5">
      {!appointment ? <p>Este enlace ya no está disponible.</p> : <>
        <p className="font-medium">{appointment.barbershop.name}</p>
        <div className="space-y-1"><p>{date.charAt(0).toUpperCase() + date.slice(1)}</p><p className="text-lg font-medium tabular-nums">{time}</p></div>
        <div><p>{appointment.service.name}</p><p className="text-sm text-muted-foreground">{appointment.barber.name}</p></div>
        <ManageAppointment slug={slug} token={token} confirmed={!!appointment.customerConfirmedAt} summary={`${date} · ${time} · ${appointment.service.name}`} />
      </>}
    </section>
    <p className="text-center text-xs text-muted-foreground">Reservas con BarberOS</p>
  </div></main>;
}
