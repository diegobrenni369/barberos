"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barberSchema } from "@/lib/validations";
import { BarberAccessError, mobileAccessSchema, provisionBarberAccess } from "@/lib/barber-access";

function fail(message: string): never { redirect(`/barbers?error=${encodeURIComponent(message)}`); }

export async function createBarber(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = barberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const wantsAccess = formData.get("mobileAccess") === "on";
  const access = wantsAccess ? mobileAccessSchema.safeParse({ email: String(formData.get("accessEmail") ?? "").trim(), password: formData.get("accessPassword") }) : null;
  if (access && !access.success) fail(access.error.issues[0].message);
  try {
    await prisma.$transaction(async tx => {
      const barber = await tx.barber.create({ data: { name: data.name, phone: data.phone || null, email: data.email || null, commissionRate: new Prisma.Decimal(data.commissionRate), isActive: data.isActive, barbershopId: membership.barbershopId } });
      if (access?.success) await provisionBarberAccess(tx, membership.barbershopId, barber.id, barber.name, access.data);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    fail(error instanceof BarberAccessError ? error.message : "No se pudo crear el barbero. Revisa el correo y vuelve a intentar.");
  }
  revalidatePath("/dashboard"); revalidatePath("/barbers");
  redirect("/barbers");
}
export async function updateBarber(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER); const id = String(formData.get("id")); const parsed = barberSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data;
  const result = await prisma.barber.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: { name: data.name, phone: data.phone || null, email: data.email || null, commissionRate: new Prisma.Decimal(data.commissionRate), isActive: data.isActive } }); if (!result.count) fail("Barbero no encontrado"); revalidatePath("/dashboard"); revalidatePath("/barbers"); redirect("/barbers");
}
export async function toggleBarber(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); await prisma.barber.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { isActive: formData.get("isActive") === "true" } }); revalidatePath("/dashboard"); revalidatePath("/barbers"); }
