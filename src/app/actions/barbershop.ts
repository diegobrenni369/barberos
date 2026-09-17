"use server";

import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barbershopSchema } from "@/lib/validations";

function errorUrl(path: string, message: string) { return `${path}?error=${encodeURIComponent(message)}`; }

export async function createBarbershop(formData: FormData) {
  const user = await requireAuth();
  const parsed = barbershopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl("/onboarding", parsed.error.issues[0].message));
  const hasMembership = await prisma.barbershopMembership.findFirst({ where: { userId: user.id } });
  if (hasMembership) redirect("/dashboard");
  try {
    await prisma.$transaction(async (tx) => {
      const barbershop = await tx.barbershop.create({ data: { ...parsed.data, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null } });
      await tx.barbershopMembership.create({ data: { userId: user.id, barbershopId: barbershop.id, role: MembershipRole.OWNER } });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") redirect(errorUrl("/onboarding", "Ese slug ya está en uso"));
    throw error;
  }
  redirect("/dashboard");
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
