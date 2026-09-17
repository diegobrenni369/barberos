import { PrismaClient, MembershipRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("barberos-demo", 12);
  const user = await prisma.user.upsert({
    where: { email: "owner@barberos.local" },
    update: {},
    create: { name: "Owner Demo", email: "owner@barberos.local", passwordHash },
  });
  const barbershop = await prisma.barbershop.upsert({
    where: { slug: "barberia-demo" },
    update: {},
    create: { name: "Barbería Demo", slug: "barberia-demo" },
  });
  await prisma.barbershopMembership.upsert({
    where: { userId_barbershopId: { userId: user.id, barbershopId: barbershop.id } },
    update: { role: MembershipRole.OWNER },
    create: { userId: user.id, barbershopId: barbershop.id, role: MembershipRole.OWNER },
  });
  await prisma.barber.upsert({
    where: { id: "seed-diego" },
    update: {},
    create: { id: "seed-diego", barbershopId: barbershop.id, name: "Diego" },
  });
}

main().finally(() => prisma.$disconnect());
