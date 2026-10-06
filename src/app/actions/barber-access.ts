"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BarberAccessError, mobileAccessSchema, provisionBarberAccess } from "@/lib/barber-access";

export async function createBarberAccess(form: FormData) {
  const membership = await requireRole("OWNER");
  const id = z.string().cuid().safeParse(form.get("barberId"));
  const input = mobileAccessSchema.safeParse({ email: String(form.get("email") ?? "").trim(), password: form.get("password") });
  if (!id.success || !input.success) return { ok: false, message: input.success ? "Barbero no válido." : input.error.issues[0].message };
  try {
    await prisma.$transaction(async tx => {
      const barber = await tx.barber.findFirst({ where: { id: id.data, barbershopId: membership.barbershopId } });
      if (!barber || barber.userId) throw new BarberAccessError("El acceso cambió. Actualiza la ficha antes de continuar.");
      await provisionBarberAccess(tx, membership.barbershopId, barber.id, barber.name, input.data);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return { ok: false, message: error instanceof BarberAccessError ? error.message : "No se pudo crear el acceso. Revisa el correo y vuelve a intentar." };
  }
  revalidatePath(`/barbers/${id.data}`);
  return { ok: true, message: "Acceso configurado. Si el usuario ya existía, conserva su contraseña anterior." };
}

export async function assignBarberAccess(_previous: { message: string }, form: FormData) {
  const membership = await requireRole("OWNER");
  const parsed = z.object({ barberId: z.string().cuid(), userId: z.union([z.string().cuid(), z.literal("none")]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Selecciona un usuario válido." };
  const { barberId, userId } = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      const barber = await tx.barber.findFirst({ where: { id: barberId, barbershopId: membership.barbershopId } });
      if (!barber) throw new Error("INVALID_ACCESS");
      const nextUserId = userId === "none" ? null : userId;
      if (nextUserId) {
        const member = await tx.barbershopMembership.findFirst({ where: { userId: nextUserId, barbershopId: membership.barbershopId, role: "BARBER" } });
        const other = await tx.barber.findFirst({ where: { userId: nextUserId, barbershopId: membership.barbershopId, id: { not: barberId } } });
        if (!member || other) throw new Error("INVALID_ACCESS");
      }
      await tx.barber.update({ where: { id: barberId, barbershopId: membership.barbershopId }, data: { userId: nextUserId } });
      if (barber.userId !== nextUserId) {
        const users = [barber.userId, nextUserId].filter((id): id is string => Boolean(id));
        await tx.mobileSession.updateMany({ where: { userId: { in: users }, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return { ok: false, message: "No se pudo asociar. Elige un usuario BARBER del mismo local sin otro profesional asociado y vuelve a intentar." };
  }
  revalidatePath(`/barbers/${barberId}`);
  return { ok: true, message: "Acceso actualizado. El usuario debe volver a iniciar sesión en Mobile." };
}
