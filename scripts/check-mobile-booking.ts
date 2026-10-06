// Focused M4 local HTTP check, not a broad suite. Fixtures are removed in finally.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { createMobileSession } from "../src/lib/mobile-auth";
import { utcToZonedParts } from "../src/lib/agenda";

async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL || "").hostname));
  const marker = randomUUID(); const shops: string[] = []; let userId: string | undefined;
  try {
    assert.equal((await fetch("http://localhost:3000/api/mobile/agenda", { signal: AbortSignal.timeout(15000) })).status, 401);
    userId = (await prisma.user.create({ data: { name: "M4", email: `${marker}@example.invalid`, passwordHash: "not-a-login-account" } })).id;
    for (const suffix of ["a", "b"]) shops.push((await prisma.barbershop.create({ data: { name: "M4", slug: `m4-${marker}-${suffix}`, timezone: "America/Santiago" } })).id);
    await prisma.barbershopMembership.create({ data: { userId, barbershopId: shops[0], role: "OWNER" } });
    const { token } = await createMobileSession(userId);
    const call = (path: string, body?: unknown, bearer = token) => fetch(`http://localhost:3000/api/mobile/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${bearer}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const [barber, outsider, customer, service, ineligible, reason, foreignReason] = await Promise.all([
      prisma.barber.create({ data: { barbershopId: shops[0], name: "M4 barber" } }),
      prisma.barber.create({ data: { barbershopId: shops[1], name: "Other barber" } }),
      prisma.customer.create({ data: { barbershopId: shops[0], name: "Juan", phone: "+56 9 1234 5678" } }),
      prisma.service.create({ data: { barbershopId: shops[0], name: "M4 service", durationMinutes: 30, price: 12345 } }),
      prisma.service.create({ data: { barbershopId: shops[0], name: "Not assigned", durationMinutes: 30, price: 1 } }),
      prisma.blockReason.create({ data: { barbershopId: shops[0], name: "M4 reason" } }),
      prisma.blockReason.create({ data: { barbershopId: shops[1], name: "Other reason" } }),
    ]);
    await prisma.barberService.create({ data: { barberId: barber.id, serviceId: service.id, barbershopId: shops[0] } });
    for (const dayOfWeek of ["MONDAY", "TUESDAY"] as const) {
      await prisma.barbershopBusinessHour.create({ data: { barbershopId: shops[0], dayOfWeek, opensMinute: 480, closesMinute: 1080 } });
      await prisma.barberAvailability.create({ data: { barbershopId: shops[0], barberId: barber.id, dayOfWeek, startMinute: 540, endMinute: 1020 } });
    }
    await prisma.barberBreak.create({ data: { barbershopId: shops[0], barberId: barber.id, dayOfWeek: "MONDAY", startMinute: 780, endMinute: 840, label: "Almuerzo" } });
    const query = `barberId=${barber.id}&serviceId=${service.id}&date=2026-10-05`;
    assert.equal((await call(`services?barberId=${barber.id}`, undefined, "invalid")).status, 401);
    assert.equal((await call(`services?barberId=${outsider.id}`)).status, 404);
    const search = await (await call("customers?query=912345678")).json(); assert.equal(search.customers[0].id, customer.id);
    const services = await (await call(`services?barberId=${barber.id}`)).json(); assert.deepEqual(services.services.map((s: { id: string }) => s.id), [service.id]);
    const slots = await (await call(`availability?${query}`)).json(); assert.ok(slots.slots.includes("09:00")); assert.ok(!slots.slots.includes("08:30")); assert.ok(!slots.slots.includes("13:00"));
    const booking = { barberId: barber.id, serviceId: service.id, date: "2026-10-05", time: "09:00", customerId: customer.id };
    assert.equal((await call("appointments", { ...booking, serviceId: ineligible.id })).status, 409);
    assert.equal((await call("appointments", { ...booking, price: 1 })).status, 400);
    const created = await call("appointments", booking); assert.equal(created.status, 200);
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: (await created.json()).id } });
    assert.equal(saved.price.toString(), "12345"); assert.equal(saved.status, "SCHEDULED"); assert.equal(saved.source, "INTERNAL");
    assert.equal((await call("appointments", booking)).status, 409);
    const { customerId: omitted, ...withContact } = booking; void omitted;
    assert.equal((await call("appointments", { ...withContact, time: "10:00", customer: { name: "Juan Pérez", phone: "912345678", email: "juan@example.invalid" } })).status, 200);
    assert.equal(await prisma.customer.count({ where: { barbershopId: shops[0] } }), 1);
    const enriched = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }); assert.equal(enriched.name, "Juan Pérez"); assert.equal(enriched.email, "juan@example.invalid");
    assert.equal((await call("appointments", { ...withContact, time: "11:00", customer: { name: "Nuevo", phone: "987654321" } })).status, 200);
    assert.equal(await prisma.customer.count({ where: { barbershopId: shops[0] } }), 2);
    const block = { barberId: barber.id, date: "2026-10-05", allDay: false, startTime: "15:00", endTime: "16:00", reasonId: reason.id };
    assert.equal((await call("blocks", { ...block, reasonId: foreignReason.id })).status, 404);
    assert.equal((await call("blocks", { ...block, startTime: "09:00", endTime: "09:30" })).status, 409);
    assert.equal((await call("blocks", block)).status, 200);
    const after = await (await call(`availability?${query}`)).json(); assert.ok(!after.slots.includes("15:00"));
    const full = await call("blocks", { barberId: barber.id, date: "2026-10-06", allDay: true, reasonId: reason.id }); assert.equal(full.status, 200);
    const whole = await prisma.barberBlock.findUniqueOrThrow({ where: { id: (await full.json()).id } });
    assert.equal(utcToZonedParts(whole.startsAt, "America/Santiago").time, "09:00"); assert.equal(utcToZonedParts(whole.endsAt, "America/Santiago").time, "17:00");
    assert.equal((await call("blocks", { barberId: barber.id, date: "2026-10-07", allDay: true, reasonId: reason.id })).status, 409);
    const agenda = await (await call(`agenda?barberId=${barber.id}&date=2026-10-05`)).json(); assert.equal(agenda.appointments.length, 3); assert.equal(agenda.blocks.length, 1);
    await prisma.barbershopMembership.updateMany({ where: { userId }, data: { barbershopId: shops[1] } });
    assert.equal((await call("appointments", { ...booking, time: "12:00" })).status, 404);
    assert.equal((await call("blocks", block)).status, 404);
    assert.equal((await (await call("customers?query=Juan")).json()).customers.length, 0);
    console.log("M4 OK: crear cita, cliente nuevo/matching, elegibilidad, slots, bloqueos horario/día, día cerrado, Agenda, bearer y tenant.");
  } finally {
    if (shops.length) {
      const where = { barbershopId: { in: shops } };
      await prisma.appointment.deleteMany({ where }); await prisma.barberBlock.deleteMany({ where });
      await prisma.barbershop.deleteMany({ where: { id: { in: shops } } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? `M4 assertion failed: expected ${JSON.stringify(error.expected)}, received ${JSON.stringify(error.actual)}` : "M4 check failed; no credentials logged."); process.exitCode = 1; });
