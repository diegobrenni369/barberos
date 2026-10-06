import { slotInput, mobileSlots } from "@/lib/mobile-booking";
import { mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async barbershopId => {
    const input = slotInput.parse(Object.fromEntries(new URL(request.url).searchParams));
    return { slots: await mobileSlots(barbershopId, input) };
  });
}

