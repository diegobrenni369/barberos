import { prisma } from "@/lib/prisma";
import { getPublicSlots, PublicBookingError } from "@/lib/public-booking";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const query = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "no-store" };
  try {
    const slots = await getPublicSlots(prisma, { slug, serviceId: query.get("service"), barberId: query.get("barber") || null, date: query.get("date") });
    return Response.json({ slots }, { headers });
  } catch (error) {
    if (!(error instanceof PublicBookingError)) console.error("Public slots failed", { code: "SLOTS_UNAVAILABLE" });
    return Response.json({ error: error instanceof PublicBookingError ? error.message : "No pudimos cargar los horarios. Intenta nuevamente." }, { status: 400, headers });
  }
}
