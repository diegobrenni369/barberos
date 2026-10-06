import { prisma } from "@/lib/prisma";
import { barberInput, MobileBookingError } from "@/lib/mobile-booking";
import { mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async barbershopId => {
    const { barberId } = barberInput.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (!await prisma.barber.findFirst({ where: { id: barberId, barbershopId, isActive: true }, select: { id: true } })) throw new MobileBookingError("Profesional no disponible.", 404);
    const services = await prisma.service.findMany({ where: { barbershopId, isActive: true, barberServices: { some: { barbershopId, barberId } } }, select: { id: true, name: true, durationMinutes: true, price: true, barbershop: { select: { currency: true } } }, orderBy: { name: "asc" } });
    return { services: services.map(({ barbershop, ...service }) => ({ ...service, price: service.price.toString(), currency: barbershop.currency })) };
  });
}

