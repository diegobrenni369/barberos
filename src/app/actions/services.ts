"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validations";
import { setServiceBarbers } from "@/lib/barber-service";
import { z } from "zod";

function fail(message: string, path = "/services"): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

async function saveService(formData: FormData, editing: boolean) {
  const membership = await requireRole(MembershipRole.OWNER);
  const section = formData.get("section");
  const sectionEdit = editing && ["information", "professionals", "online"].includes(String(section));
  const serviceId = String(formData.get("id") ?? "");
  const path = sectionEdit && z.string().cuid().safeParse(serviceId).success ? `/services/${serviceId}` : "/services";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async tx => {
        let id = serviceId;
        const submitted = Object.fromEntries(formData);
        let fields = submitted;
        let barberIds = formData.getAll("barberIds");
        if (sectionEdit) {
          const current = await tx.service.findFirst({ where: { id, barbershopId: membership.barbershopId }, include: { barberServices: { where: { barbershopId: membership.barbershopId, barber: { isActive: true } }, select: { barberId: true } } } });
          if (!current) throw new Error("Servicio no encontrado");
          const keys = section === "information" ? ["name", "description", "durationMinutes", "price", "isActive"] : section === "online" ? ["isOnlineBookingEnabled", "onlinePaymentPolicy", "depositAmount"] : [];
          fields = {
            name: current.name, description: current.description || "", durationMinutes: String(current.durationMinutes), price: current.price.toString(),
            isActive: String(current.isActive), isOnlineBookingEnabled: String(current.isOnlineBookingEnabled),
            onlinePaymentPolicy: current.onlinePaymentPolicy, depositAmount: current.depositAmount?.toString() || "",
            ...Object.fromEntries(keys.map(key => [key, submitted[key] ?? ""])),
          };
          if (section !== "professionals") barberIds = current.barberServices.map(link => link.barberId);
        }
        const parsed = serviceSchema.safeParse(fields);
        const selection = z.array(z.string().min(1).max(128)).max(1000).safeParse(barberIds);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        if (!selection.success) throw new Error("Selecciona profesionales válidos.");
        const data = parsed.data;
        const values = { name: data.name, description: data.description || null, durationMinutes: data.durationMinutes, price: new Prisma.Decimal(data.price), isActive: data.isActive, isOnlineBookingEnabled: data.isOnlineBookingEnabled, onlinePaymentPolicy: data.onlinePaymentPolicy, depositAmount: data.onlinePaymentPolicy === "DEPOSIT" && data.depositAmount ? new Prisma.Decimal(data.depositAmount) : null };
        if (editing) {
          const result = await tx.service.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: values });
          if (!result.count) throw new Error("Servicio no encontrado");
        } else {
          id = (await tx.service.create({ data: { ...values, barbershopId: membership.barbershopId }, select: { id: true } })).id;
        }
        await setServiceBarbers(tx, membership.barbershopId, id, selection.data, data.isActive && data.isOnlineBookingEnabled);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034" && attempt < 2) continue;
        fail("La configuración cambió. Intenta nuevamente.", path);
      }
      if (error instanceof Error) fail(error.message, path);
      throw error;
    }
  }
  revalidatePath("/services"); revalidatePath("/agenda"); revalidatePath("/book/[slug]", "page"); if (editing) revalidatePath(`/services/${serviceId}`); redirect(sectionEdit ? `${path}?success=Servicio+actualizado.` : "/services");
}
export async function createService(formData: FormData) { return saveService(formData, false); }
export async function updateService(formData: FormData) { return saveService(formData, true); }
export async function toggleService(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const id = String(formData.get("id")); const isActive = formData.get("isActive") === "true";
  try {
    await prisma.$transaction(async tx => {
      const service = await tx.service.findFirst({ where: { id, barbershopId: membership.barbershopId }, select: { isOnlineBookingEnabled: true } });
      if (!service) throw new Error("Servicio no encontrado");
      if (isActive && service.isOnlineBookingEnabled && !await tx.barberService.count({ where: { serviceId: id, barbershopId: membership.barbershopId, barber: { isActive: true } } })) throw new Error("Selecciona al menos un profesional activo antes de activar este servicio online.");
      await tx.service.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: { isActive } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) fail("La configuración cambió. Intenta nuevamente.");
    if (error instanceof Error) fail(error.message);
    throw error;
  }
  revalidatePath("/services"); revalidatePath(`/services/${id}`); revalidatePath("/agenda"); revalidatePath("/book/[slug]", "page");
}
