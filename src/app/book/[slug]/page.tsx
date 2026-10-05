import { PublicImage } from "@/components/public-image";
import { instagramLink } from "@/lib/public-branding";
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
  const shop = await prisma.barbershop.findFirst({ where: { slug, isActive: true }, select: { logoUrl: true, coverImageUrl: true, publicDescription: true, instagramUrl: true, id: true, name: true, address: true, currency: true, timezone: true } });
  if (!shop) notFound();
  const [services, barbers, hours] = await Promise.all([
    prisma.service.findMany({ where: { barbershopId: shop.id, isActive: true, isOnlineBookingEnabled: true, onlinePaymentPolicy: "NONE", barberServices: { some: { barbershopId: shop.id, barber: { isActive: true } } } }, select: { publicImageUrl: true, id: true, name: true, durationMinutes: true, price: true, barberServices: { where: { barbershopId: shop.id, barber: { isActive: true } }, select: { barberId: true } } }, orderBy: { name: "asc" } }),
    prisma.barber.findMany({ where: { barbershopId: shop.id, isActive: true }, select: { publicImageUrl: true, id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.barbershopBusinessHour.findMany({ where: { barbershopId: shop.id, isClosed: false }, select: { dayOfWeek: true } }),
  ]);
  const today = utcToZonedParts(new Date(), shop.timezone).date;
  return <main lang="es" className="min-h-dvh bg-muted/20 px-4 py-8 sm:py-12"><div className="mx-auto w-full max-w-lg space-y-7">
    <header className="space-y-3"><PublicImage src={shop.coverImageUrl} alt="" className="h-32 w-full rounded-xl object-cover sm:h-40" /><div className="flex min-w-0 items-center gap-3"><PublicImage src={shop.logoUrl} alt="" className="size-12 shrink-0 rounded-lg object-contain" /><p className="min-w-0 break-words text-sm font-medium tracking-wide">{shop.name}</p></div><h1 className="text-3xl font-semibold tracking-tight">Reserva tu hora</h1>{shop.publicDescription && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{shop.publicDescription}</p>}{shop.address && <p className="break-words text-sm text-muted-foreground">{shop.address}</p>}{shop.instagramUrl && instagramLink(shop.instagramUrl) && <a href={instagramLink(shop.instagramUrl)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Instagram</a>}</header>
    <BookingFlow address={shop.address} slug={slug} currency={shop.currency} services={services.map(({ barberServices, ...service }) => ({ ...service, barberIds: barberServices.map(link => link.barberId), price: service.price.toString() }))} barbers={barbers} today={today} lastDate={bookingDateLimit(today)} openDays={hours.map(hour => DAYS.indexOf(hour.dayOfWeek))} />
    <p className="text-center text-xs text-muted-foreground">Reservas con BarberOS</p>
  </div></main>;
}
