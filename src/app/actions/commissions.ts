"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleCommissions, SettlementError } from "@/lib/commissions";

export async function payCommission(input: unknown) {
  const membership = await requireRole("OWNER");
  try {
    await settleCommissions(prisma, membership.barbershopId, input);
    revalidatePath("/commissions");
    revalidatePath("/barbers", "layout");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof SettlementError ? error.message : "No se pudo registrar la liquidación. Actualiza antes de reintentar." };
  }
}
