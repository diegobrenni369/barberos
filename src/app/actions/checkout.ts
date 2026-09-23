"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutError, registerCheckout } from "@/lib/checkout";

export async function checkoutAppointment(input: unknown): Promise<{ ok: true; saleId: string } | { ok: false; error: string }> {
  const membership = await requireRole("OWNER");
  try {
    const saleId = await registerCheckout(prisma, membership.barbershopId, input);
    revalidatePath("/dashboard"); revalidatePath("/agenda");
    revalidatePath("/cash");
    return { ok: true, saleId };
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, error: error.message };
    console.error("Checkout failed", error);
    return { ok: false, error: "No se pudo confirmar el cobro. Actualiza la agenda antes de reintentar." };
  }
}
