import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async barbershopId => {
    const query = z.string().trim().max(100).parse(new URL(request.url).searchParams.get("query") ?? "");
    const overview = new URL(request.url).searchParams.get("overview") === "1";
    const digits = query.replace(/\D/g, "");
    const customers = await prisma.$queryRaw<{ id: string; name: string; phone: string | null; email: string | null }[]>`
      SELECT "id", "name", "phone", "email" FROM "Customer"
      WHERE "barbershopId" = ${barbershopId} AND (${overview} OR "isActive" = true)
        AND (position(lower(${query}) in lower("name")) > 0
          OR (${digits} <> '' AND position(${digits} in regexp_replace("phone", '[^0-9]', '', 'g')) > 0))
      ORDER BY "name", "id" LIMIT 20
    `;
    if (!overview) return { customers };
    const upcoming = await prisma.customer.findMany({
      where: { barbershopId, id: { in: customers.map(customer => customer.id) } },
      select: { id: true, appointments: {
        where: { barbershopId, startsAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 1, select: { startsAt: true },
      } },
    });
    const nextByCustomer = new Map(upcoming.map(customer => [customer.id, customer.appointments[0]?.startsAt.toISOString() ?? null]));
    return { customers: customers.map(({ id, name, phone }) => ({ id, name, phone, nextAt: nextByCustomer.get(id) ?? null })), limit: 20 };
  });
}
