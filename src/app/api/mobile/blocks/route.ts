import { mobileBarberInput } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { blockInput, dayInput, createMobileBlock, loadMobileDay } from "@/lib/mobile-booking";
import { mobileBookingBody, mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async (barbershopId, access) => {
    const input = dayInput.parse(mobileBarberInput(access, Object.fromEntries(new URL(request.url).searchParams)));
    const day = await loadMobileDay(prisma, barbershopId, input);
    const reasons = await prisma.blockReason.findMany({ where: { barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return { reasons, intervals: day.intervals };
  });
}
export async function POST(request: Request) {
  return mobileBookingRoute(request, async (barbershopId, access) => {
    const result = await createMobileBlock(barbershopId, blockInput.parse(mobileBarberInput(access, await mobileBookingBody(request))));
    revalidatePath("/agenda");
    return result;
  });
}
