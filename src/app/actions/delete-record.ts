"use server";

import { MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({ kind: z.enum(["customer", "barber", "service"]), id: z.string().cuid() }).strict();

export async function deleteRecord(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Registro inválido." };
  const { kind, id } = parsed.data;
  const where = { id, barbershopId: membership.barbershopId };
  const blocked = kind === "barber"
    ? "Este barbero tiene actividad registrada. Puedes desactivarlo."
    : kind === "customer"
      ? "Este cliente tiene actividad registrada. Puedes desactivarlo."
      : "Este servicio tiene actividad o profesionales vinculados. Puedes desactivarlo.";
  try {
    const result = await prisma.$transaction(async tx => {
      // Lock the parent before checking children: concurrent FK inserts must wait.
      // Table names are constants, never interpolated from user input.
      const locked = kind === "customer"
        ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE id = ${id} AND "barbershopId" = ${where.barbershopId} FOR UPDATE`
        : kind === "barber"
          ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Barber" WHERE id = ${id} AND "barbershopId" = ${where.barbershopId} FOR UPDATE`
          : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Service" WHERE id = ${id} AND "barbershopId" = ${where.barbershopId} FOR UPDATE`;
      if (!locked.length) return { ok: false, error: "Registro no encontrado." };
      // All statuses count, including cancelled appointments and voided sales.
      // Reminders/access tokens belong to Appointment, so that guard protects both.
      const record = kind === "customer"
        ? await tx.customer.findFirst({ where, select: { _count: { select: { appointments: true, sales: true } } } })
        : kind === "barber"
          ? await tx.barber.findFirst({ where, select: { _count: { select: { appointments: true, sales: true, commissions: true, settlements: true, blocks: true, breaks: true, availabilities: true, barberServices: true } } } })
          : await tx.service.findFirst({ where, select: { _count: { select: { appointments: true, saleItems: true, barberServices: true } } } });
      if (!record || Object.values(record._count).some(count => count > 0)) return { ok: false, error: blocked };
      if (kind === "customer") await tx.customer.deleteMany({ where });
      else if (kind === "barber") await tx.barber.deleteMany({ where });
      else await tx.service.deleteMany({ where });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result.ok) return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return { ok: false, error: blocked };
    return { ok: false, error: "No se pudo eliminar. El registro puede haber cambiado; vuelve a intentarlo." };
  }
  revalidatePath(kind === "customer" ? "/customers" : kind === "barber" ? "/barbers" : "/services");
  return { ok: true };
}
