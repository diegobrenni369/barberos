import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicSlug } from "@/lib/public-booking-input";
import { bookingDateLimit } from "@/lib/public-booking";
import { utcToZonedParts } from "@/lib/agenda";
import { DAYS } from "@/lib/barber-availability";
import { BookingFlow } from "@/components/booking/booking-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reserva tu hora | BarberOS", description: "Elige tu servicio, profesional y horario." };

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!publicSlug.safeParse(slug).success) notFound();
  const shop = await prisma.barbershop.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, address: true, currency: true, timezone: true } });
  if (!shop) notFound();
  const [services, barbers, hours] = await Promise.all([
    prisma.service.findMany({ where: { barbershopId: shop.id, isActive: true, isOnlineBookingEnabled: true, onlinePaymentPolicy: "NONE" }, select: { id: true, name: true, durationMinutes: true, price: true }, orderBy: { name: "asc" } }),
    prisma.barber.findMany({ where: { barbershopId: shop.id, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.barbershopBusinessHour.findMany({ where: { barbershopId: shop.id, isClosed: false }, select: { dayOfWeek: true } }),
  ]);
  const today = utcToZonedParts(new Date(), shop.timezone).date;
  return <main lang="es" className="min-h-dvh bg-muted/20 px-4 py-8 sm:py-12"><div className="mx-auto w-full max-w-lg space-y-7">
    <header className="space-y-2"><p className="text-sm font-medium tracking-wide">{shop.name}</p><h1 className="text-3xl font-semibold tracking-tight">Reserva tu hora</h1>{shop.address && <p className="break-words text-sm text-muted-foreground">{shop.address}</p>}</header>
    <BookingFlow address={shop.address} slug={slug} currency={shop.currency} services={services.map(service => ({ ...service, price: service.price.toString() }))} barbers={barbers} today={today} lastDate={bookingDateLimit(today)} openDays={hours.map(hour => DAYS.indexOf(hour.dayOfWeek))} />
    <p className="text-center text-xs text-muted-foreground">Reservas con BarberOS</p>
  </div></main>;
}
