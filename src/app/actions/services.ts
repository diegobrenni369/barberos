"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validations";

function fail(message: string): never { redirect(`/services?error=${encodeURIComponent(message)}`); }

export async function createService(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER); const parsed = serviceSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data;
  await prisma.service.create({ data: { name: data.name, description: data.description || null, durationMinutes: data.durationMinutes, price: new Prisma.Decimal(data.price), isActive: data.isActive, isOnlineBookingEnabled: data.isOnlineBookingEnabled, onlinePaymentPolicy: data.onlinePaymentPolicy, depositAmount: data.onlinePaymentPolicy === "DEPOSIT" && data.depositAmount ? new Prisma.Decimal(data.depositAmount) : null, barbershopId: membership.barbershopId } }); revalidatePath("/services"); redirect("/services");
}
export async function updateService(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER); const id = String(formData.get("id")); const parsed = serviceSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data;
  const result = await prisma.service.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: { name: data.name, description: data.description || null, durationMinutes: data.durationMinutes, price: new Prisma.Decimal(data.price), isActive: data.isActive, isOnlineBookingEnabled: data.isOnlineBookingEnabled, onlinePaymentPolicy: data.onlinePaymentPolicy, depositAmount: data.onlinePaymentPolicy === "DEPOSIT" && data.depositAmount ? new Prisma.Decimal(data.depositAmount) : null } }); if (!result.count) fail("Servicio no encontrado"); revalidatePath("/services"); redirect("/services");
}
export async function toggleService(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); await prisma.service.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { isActive: formData.get("isActive") === "true" } }); revalidatePath("/services"); }
