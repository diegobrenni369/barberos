import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { registerSchema } from "@/lib/validations";

export const mobileAccessSchema = registerSchema.pick({ email: true, password: true });
export class BarberAccessError extends Error {}

// Call only inside a serializable transaction after OWNER/tenant authorization.
export async function provisionBarberAccess(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, name: string, input: { email: string; password: string }) {
  const existing = await tx.user.findUnique({ where: { email: input.email } });
  let userId: string;
  if (existing) {
    const member = await tx.barbershopMembership.findUnique({ where: { userId_barbershopId: { userId: existing.id, barbershopId } } });
    if (!member || member.role !== "BARBER") throw new BarberAccessError("Ese correo no corresponde a un usuario BARBER de esta barbería. No se modificó su acceso.");
    const assigned = await tx.barber.findFirst({ where: { userId: existing.id, barbershopId, id: { not: barberId } } });
    if (assigned) throw new BarberAccessError("Ese usuario ya está asociado a otro barbero.");
    userId = existing.id;
    // Never reset an existing account's credentials through staff provisioning.
  } else {
    const user = await tx.user.create({ data: { name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), memberships: { create: { barbershopId, role: "BARBER" } } } });
    userId = user.id;
  }
  await tx.barber.update({ where: { id: barberId, barbershopId }, data: { userId } });
  await tx.mobileSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
