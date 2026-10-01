"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { allowPublicRequest } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { confirmPublicBooking, PublicBookingError } from "@/lib/public-booking";
import type { BookingConfirmation } from "@/lib/public-booking-input";

export async function bookAppointment(input: unknown): Promise<{ ok: true; confirmation: BookingConfirmation } | { ok: false; error: string }> {
  let confirmation: BookingConfirmation;
  try {
    if (!await allowPublicRequest(prisma, await headers(), "booking")) return { ok: false, error: "Demasiados intentos. Espera un minuto antes de volver a reservar." };
    confirmation = await confirmPublicBooking(prisma, input);
  } catch (error) {
    if (!(error instanceof PublicBookingError)) console.error("Public booking failed", { code: "BOOKING_FAILED" });
    return { ok: false, error: error instanceof PublicBookingError ? error.message : "No pudimos confirmar la reserva. Revisa los horarios antes de reintentar." };
  }
  revalidatePath("/dashboard"); revalidatePath("/agenda");
  return { ok: true, confirmation };
}
