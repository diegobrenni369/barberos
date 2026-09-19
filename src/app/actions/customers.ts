"use server";

import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validations";

function fail(message: string): never { redirect(`/customers?error=${encodeURIComponent(message)}`); }
export async function createCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); const parsed = customerSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data; await prisma.customer.create({ data: { ...data, phone: data.phone || null, email: data.email || null, notes: data.notes || null, barbershopId: membership.barbershopId } }); revalidatePath("/customers"); redirect("/customers"); }
export async function updateCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); const parsed = customerSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data; const result = await prisma.customer.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { ...data, phone: data.phone || null, email: data.email || null, notes: data.notes || null } }); if (!result.count) fail("Cliente no encontrado"); revalidatePath("/customers"); redirect("/customers"); }
export async function toggleCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); await prisma.customer.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { isActive: formData.get("isActive") === "true" } }); revalidatePath("/customers"); }
