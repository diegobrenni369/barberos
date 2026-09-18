"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barberSchema } from "@/lib/validations";

function fail(message: string): never { redirect(`/barbers?error=${encodeURIComponent(message)}`); }

export async function createBarber(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = barberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const data = parsed.data;
  await prisma.barber.create({ data: { name: data.name, phone: data.phone || null, email: data.email || null, commissionRate: new Prisma.Decimal(data.commissionRate), isActive: data.isActive, barbershopId: membership.barbershopId } });
  revalidatePath("/barbers");
}
export async function updateBarber(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER); const id = String(formData.get("id")); const parsed = barberSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data;
  const result = await prisma.barber.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: { name: data.name, phone: data.phone || null, email: data.email || null, commissionRate: new Prisma.Decimal(data.commissionRate), isActive: data.isActive } }); if (!result.count) fail("Barbero no encontrado"); revalidatePath("/barbers");
}
export async function toggleBarber(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); await prisma.barber.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { isActive: formData.get("isActive") === "true" } }); revalidatePath("/barbers"); }
