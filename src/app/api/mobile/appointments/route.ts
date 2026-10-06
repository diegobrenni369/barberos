import { revalidatePath } from "next/cache";
import { bookingInput, createMobileBooking } from "@/lib/mobile-booking";
import { mobileBookingBody, mobileBookingRoute } from "@/lib/mobile-booking-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mobileBookingRoute(request, async barbershopId => {
    const result = await createMobileBooking(barbershopId, bookingInput.parse(await mobileBookingBody(request)));
    revalidatePath("/agenda"); revalidatePath("/dashboard");
    return result;
  });
}

