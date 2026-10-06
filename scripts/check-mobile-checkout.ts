// Focused local HTTP/DB check. All fixtures are isolated and removed.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { createMobileSession } from "../src/lib/mobile-auth";

async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL || "").hostname));
  const marker = randomUUID(); const shops: string[] = []; let userId: string | undefined;
  try {
    assert.equal((await fetch("http://localhost:3000/api/mobile/agenda", { signal: AbortSignal.timeout(15000) })).status, 401);
    userId = (await prisma.user.create({ data: { name: "M3 check", email: `${marker}@example.invalid`, passwordHash: "not-a-login-account" } })).id;
    for (const suffix of ["a", "b"]) shops.push((await prisma.barbershop.create({ data: { name: "M3 check", slug: `m3-${marker}-${suffix}`, currency: "CLP" } })).id);
    await prisma.barbershopMembership.create({ data: { userId, barbershopId: shops[0], role: "OWNER" } });
    const { token } = await createMobileSession(userId);
    const barber = await prisma.barber.create({ data: { barbershopId: shops[0], name: "M3 barber", commissionRate: 50 } });
    const customer = await prisma.customer.create({ data: { barbershopId: shops[0], name: "M3 customer" } });
    const service = await prisma.service.create({ data: { barbershopId: shops[0], name: "M3 service", durationMinutes: 30, price: 20000 } });
    const create = () => prisma.appointment.create({ data: { barbershopId: shops[0], barberId: barber.id, customerId: customer.id, serviceId: service.id, startsAt: new Date("2026-10-06T12:00:00Z"), endsAt: new Date("2026-10-06T12:30:00Z"), price: 10000 } });
    const pay = (id: string, body: unknown, bearer = token) => fetch(`http://localhost:3000/api/mobile/appointments/${id}/checkout`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const first = await create();
    assert.equal((await pay(first.id, { paymentMethod: "CASH" }, "invalid")).status, 401);
    assert.equal((await pay("missing", { paymentMethod: "CASH" })).status, 404);
    assert.equal((await pay(first.id, { paymentMethod: "OTHER" })).status, 400);
    assert.equal((await pay(first.id, { paymentMethod: "CASH", price: 1 })).status, 400);
    await prisma.barbershopMembership.updateMany({ where: { userId }, data: { barbershopId: shops[1] } });
    assert.equal((await pay(first.id, { paymentMethod: "CASH" })).status, 404);
    await prisma.barbershopMembership.updateMany({ where: { userId }, data: { barbershopId: shops[0] } });
    for (const method of ["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER"]) {
      const a = method === "CASH" ? first : await create();
      const results = await Promise.all([pay(a.id, { paymentMethod: method }), pay(a.id, { paymentMethod: method })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      const sale = await prisma.sale.findUniqueOrThrow({ where: { appointmentId: a.id }, include: { payments: true, items: true, commission: true } });
      assert.equal(sale.total.toString(), "10000"); assert.equal(sale.payments.length, 1); assert.equal(sale.items.length, 1);
      assert.equal(sale.payments[0].method, method); assert.equal(sale.payments[0].amount.toString(), "10000");
      assert.equal(sale.commission?.amount.toString(), "5000"); assert.equal(sale.commission?.rate.toString(), "50");
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status, "COMPLETED");
    }
    for (const status of ["CANCELLED", "NO_SHOW"] as const) {
      const a = await create(); await prisma.appointment.update({ where: { id: a.id }, data: { status } });
      assert.equal((await pay(a.id, { paymentMethod: "CASH" })).status, 409);
      assert.equal(await prisma.sale.count({ where: { appointmentId: a.id } }), 0);
    }
    // Force a failure after Sale creation, inside the shared transaction, to verify rollback.
    const a = await create();
    const { checkoutInTransaction } = await import("../src/lib/checkout");
    await assert.rejects(prisma.$transaction(async tx => { await checkoutInTransaction(tx, shops[0], { appointmentId: a.id, expectedUpdatedAt: a.updatedAt.toISOString(), discountAmount: "0", method: "CASH" }); throw new Error("ROLLBACK_CHECK"); }), /ROLLBACK_CHECK/);
    assert.equal(await prisma.sale.count({ where: { appointmentId: a.id } }), 0);
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status, "SCHEDULED");
    console.log("M3 OK: 4 medios, precio persistido, Sale/Payment/Commission, COMPLETED, doble cobro concurrente, estados, tenant, bearer y rollback.");
  } finally {
    if (shops.length) {
      const where = { barbershopId: { in: shops } };
      await prisma.commission.deleteMany({ where }); await prisma.payment.deleteMany({ where }); await prisma.saleItem.deleteMany({ where }); await prisma.sale.deleteMany({ where });
      await prisma.appointment.deleteMany({ where }); await prisma.barbershop.deleteMany({ where: { id: { in: shops } } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? `M3 assertion failed: expected ${JSON.stringify(error.expected)}, received ${JSON.stringify(error.actual)}` : "M3 check failed; no credentials logged."); process.exitCode = 1; });
