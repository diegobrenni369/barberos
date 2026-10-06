import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async barbershopId => {
    const query = z.string().trim().max(100).parse(new URL(request.url).searchParams.get("query") ?? "");
    const digits = query.replace(/\D/g, "");
    const customers = await prisma.$queryRaw<{ id: string; name: string; phone: string | null; email: string | null }[]>`
      SELECT "id", "name", "phone", "email" FROM "Customer"
      WHERE "barbershopId" = ${barbershopId} AND "isActive" = true
        AND (position(lower(${query}) in lower("name")) > 0
          OR (${digits} <> '' AND position(${digits} in regexp_replace("phone", '[^0-9]', '', 'g')) > 0))
      ORDER BY "name", "id" LIMIT 20
    `;
    return { customers };
  });
}

