"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barbershopSchema } from "@/lib/validations";

function errorUrl(path: string, message: string) { return `${path}?error=${encodeURIComponent(message)}`; }
const ONBOARDING_TRANSACTION_RETRIES = 3;

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function createBarbershop(formData: FormData) {
  const user = await requireAuth();
  const parsed = barbershopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl("/onboarding", parsed.error.issues[0].message));
  for (let attempt = 0; attempt < ONBOARDING_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const existingMembership = await tx.barbershopMembership.findFirst({ where: { userId: user.id } });
        if (existingMembership) return false;
        const barbershop = await tx.barbershop.create({ data: { ...parsed.data, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null } });
        await tx.barbershopMembership.create({ data: { userId: user.id, barbershopId: barbershop.id, role: MembershipRole.OWNER } });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!created) redirect("/dashboard");
      redirect("/dashboard");
    } catch (error) {
      if (isSerializationConflict(error) && attempt < ONBOARDING_TRANSACTION_RETRIES - 1) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect(errorUrl("/onboarding", "Ese slug ya está en uso"));
      if (isSerializationConflict(error)) redirect(errorUrl("/onboarding", "No pudimos crear la barbería. Intenta nuevamente."));
      throw error;
    }
  }
  redirect(errorUrl("/onboarding", "No pudimos crear la barbería. Intenta nuevamente."));
}

export async function updateBarbershop(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = barbershopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl("/settings", parsed.error.issues[0].message));
  try {
    await prisma.barbershop.update({
      where: { id: membership.barbershopId },
      data: { ...parsed.data, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") redirect(errorUrl("/settings", "Ese slug ya está en uso"));
    throw error;
  }
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?success=Configuración+guardada");
}
