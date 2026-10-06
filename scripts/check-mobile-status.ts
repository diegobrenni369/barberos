// Focused M2 HTTP check against the local development server, not an E2E suite.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { createMobileSession } from "../src/lib/mobile-auth";
import { zonedDateTimeToUtc } from "../src/lib/agenda";

async function main() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL || "").hostname)) throw new Error("Local database required");
  const marker = randomUUID();
  const shops: string[] = [];
  let userId: string | undefined;
  try {
    // Fail before creating fixtures if the local server is unavailable.
    const probe = await fetch("http://localhost:3000/api/mobile/agenda", { signal: AbortSignal.timeout(15000) });
    assert.equal(probe.status, 401);
    userId = (await prisma.user.create({ data: { name: "M2 check", email: `${marker}@example.invalid`, passwordHash: "not-a-login-account" } })).id;
    for (const suffix of ["a", "b"]) shops.push((await prisma.barbershop.create({ data: { name: "M2 check", slug: `m2-${marker}-${suffix}`, timezone: "America/Santiago" } })).id);
    await prisma.barbershopMembership.create({ data: { userId, barbershopId: shops[0], role: "OWNER" } });
    const { token } = await createMobileSession(userId);
    const appointments: string[] = [];
    for (const barbershopId of shops) {
      const barber = await prisma.barber.create({ data: { barbershopId, name: "M2 barber" } });
      const customer = await prisma.customer.create({ data: { barbershopId, name: "M2 customer" } });
      const service = await prisma.service.create({ data: { barbershopId, name: "M2 service", durationMinutes: 30, price: 10000 } });
      await prisma.barbershopBusinessHour.create({ data: { barbershopId, dayOfWeek: "MONDAY", opensMinute: 480, closesMinute: 1080 } });
      appointments.push((await prisma.appointment.create({ data: { barbershopId, barberId: barber.id, customerId: customer.id, serviceId: service.id, startsAt: zonedDateTimeToUtc("2026-10-05", "09:00", "America/Santiago"), endsAt: zonedDateTimeToUtc("2026-10-05", "09:30", "America/Santiago"), price: 10000 } })).id);
    }
    const change = (id: string, status: string, bearer = token) => fetch(`http://localhost:3000/api/mobile/appointments/${id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }), signal: AbortSignal.timeout(20000) });
    assert.equal((await change(appointments[0], "CONFIRMED", "invalid")).status, 401);
    assert.equal((await change(appointments[0], "COMPLETED")).status, 400);
    assert.equal((await change(appointments[1], "CANCELLED")).status, 404);
    assert.equal((await change("missing", "CANCELLED")).status, 404);
    assert.equal((await change(appointments[0], "CONFIRMED")).status, 200);
    assert.equal((await change(appointments[0], "CONFIRMED")).status, 409);
    assert.equal((await change(appointments[0], "NO_SHOW")).status, 200);
    assert.equal((await change(appointments[0], "CANCELLED")).status, 409);
    // Reset only this isolated fixture to cover cancellation from active state.
    await prisma.appointment.update({ where: { id: appointments[0] }, data: { status: "SCHEDULED" } });
    assert.equal((await change(appointments[0], "CANCELLED")).status, 200);
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointments[0] } })).status, "CANCELLED");
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointments[1] } })).status, "SCHEDULED");
    console.log("M2 OK: bearer, status, tenant, inexistente, confirmar, no-show, cancelar y transición rechazada.");
  } finally {
    if (shops.length) {
      await prisma.appointment.deleteMany({ where: { barbershopId: { in: shops } } });
      await prisma.barbershop.deleteMany({ where: { id: { in: shops } } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? `M2 assertion failed: expected ${error.expected}, received ${error.actual}` : "M2 check failed; no credentials logged."); process.exitCode = 1; });
