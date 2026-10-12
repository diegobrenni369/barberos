"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchOrCreateCustomer, normalizeCustomerPhone } from "@/lib/customer-matching";
import { publicBookingInput } from "@/lib/public-booking-input";
import { customerSchema } from "@/lib/validations";

function fail(message: string): never { redirect(`/customers?error=${encodeURIComponent(message)}`); }

export async function createAgendaCustomer(formData: FormData): Promise<{ customer?: { id: string; name: string }; error?: string }> {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = publicBookingInput.pick({ name: true, phone: true, email: true }).safeParse({
    name: formData.get("name"), phone: formData.get("phone"), email: formData.get("email") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const customer = await prisma.$transaction(async tx => {
      const matched = await matchOrCreateCustomer(tx, membership.barbershopId, parsed.data);
      // Read back the enriched name; never reactivate a customer implicitly.
      const saved = await tx.customer.findFirst({ where: { id: matched.id, barbershopId: membership.barbershopId, isActive: true }, select: { id: true, name: true } });
      if (!saved) throw new Error("CUSTOMER_INACTIVE");
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/customers");
    revalidatePath("/agenda");
    return { customer };
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_INACTIVE") return { error: "Este cliente está desactivado. Revísalo en Clientes." };
    return { error: "No se pudo guardar el cliente. Intenta nuevamente." };
  }
}
export async function createCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); const parsed = customerSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data; await prisma.customer.create({ data: { ...data, phone: normalizeCustomerPhone(data.phone), email: data.email || null, notes: data.notes || null, barbershopId: membership.barbershopId } }); revalidatePath("/customers"); redirect("/customers?success=Cliente+creado."); }
export async function updateCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); const parsed = customerSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) fail(parsed.error.issues[0].message); const data = parsed.data; const result = await prisma.customer.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { ...data, phone: normalizeCustomerPhone(data.phone), email: data.email || null, notes: data.notes || null } }); if (!result.count) fail("Cliente no encontrado"); revalidatePath("/customers"); redirect("/customers?success=Cliente+actualizado."); }
export async function toggleCustomer(formData: FormData) { const membership = await requireRole(MembershipRole.OWNER); await prisma.customer.updateMany({ where: { id: String(formData.get("id")), barbershopId: membership.barbershopId }, data: { isActive: formData.get("isActive") === "true" } }); revalidatePath("/customers"); }
