import { prisma } from "@/lib/prisma";
import { getCustomerProfile } from "@/lib/customer-profile";
import { mobileResponse, resolveMobileAccess } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const { id } = await context.params;
    const { barbershopId, barbershop } = access.membership;
    const profile = await getCustomerProfile(prisma, barbershopId, id);
    if (!profile) return mobileResponse({ error: "Cliente no encontrado." }, 404);
    const shop = await prisma.barbershop.findUniqueOrThrow({ where: { id: barbershopId }, select: { currency: true } });
    const { customer, next } = profile;
    return mobileResponse({
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
      timezone: barbershop.timezone, currency: shop.currency,
      summary: { visits: profile.counts.COMPLETED ?? 0, spent: profile.total.toString(), average: profile.average.toString(), lastVisit: profile.lastVisit?.toISOString() ?? null },
      next: next ? { id: next.id, startsAt: next.startsAt.toISOString(), service: next.service.name, barber: next.barber.name, status: next.status } : null,
      history: profile.history.map(row => ({
        id: row.id, startsAt: row.startsAt.toISOString(), service: row.service.name, barber: row.barber.name, status: row.status,
        total: row.sale?.status === "COMPLETED" ? row.sale.total.toString() : null,
        currency: row.sale?.status === "COMPLETED" ? row.sale.currency : shop.currency,
      })),
    });
  } catch {
    return mobileResponse({ error: "No se pudo cargar el cliente. Intenta nuevamente." }, 503);
  }
}
