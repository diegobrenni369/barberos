import { DayOfWeek, PrismaClient, MembershipRole } from "@prisma/client";
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
  await Promise.all(Object.values(DayOfWeek).map((dayOfWeek) => prisma.barbershopBusinessHour.upsert({
    where: { barbershopId_dayOfWeek: { barbershopId: barbershop.id, dayOfWeek } },
    update: {},
    create: { barbershopId: barbershop.id, dayOfWeek, opensMinute: 480, closesMinute: 1200 },
  })));
  await Promise.all(["Trámite personal", "Médico", "Capacitación", "Reunión", "Permiso", "Vacaciones", "Ausencia", "Otro"].map((name) => prisma.blockReason.upsert({
    where: { barbershopId_name: { barbershopId: barbershop.id, name } }, update: {}, create: { barbershopId: barbershop.id, name },
  })));
  await prisma.barber.upsert({
    where: { id: "seed-diego" },
    update: {},
    create: { id: "seed-diego", barbershopId: barbershop.id, name: "Diego" },
  });
  await Promise.all([
    { name: "Corte clásico", durationMinutes: 45, price: 12000 },
    { name: "Corte y barba", durationMinutes: 60, price: 18000 },
    { name: "Perfilado de barba", durationMinutes: 30, price: 9000 },
  ].map((service) => prisma.service.upsert({
    where: { id: `seed-service-${service.durationMinutes}` }, update: {},
    create: { id: `seed-service-${service.durationMinutes}`, barbershopId: barbershop.id, ...service, barberServices: { create: { barber: { connect: { id: "seed-diego" } } } } },
  })));
}

main().finally(() => prisma.$disconnect());
