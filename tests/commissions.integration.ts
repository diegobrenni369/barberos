import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { commissionPeriod, getCommissions, settleCommissions } from "../src/lib/commissions";

const db = new PrismaClient();
const tenant = `settlement-test-${randomUUID()}`;
const other = `settlement-test-${randomUUID()}`;
async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  try {
    await db.barbershop.createMany({ data: [tenant, other].map(id => ({ id, slug: id, name: id })) });
    const barber = await db.barber.create({ data: { barbershopId: tenant, name: "Diego", commissionRate: "50" } });
    const period = commissionPeriod("America/Santiago", { period: "custom", start: "2026-09-01", end: "2026-09-30" });
    const input = { barberId: barber.id, start: period.start, end: period.end };
    const make = (base: string, rate: string, amount: string, status: "COMPLETED" | "VOIDED" = "COMPLETED") => db.sale.create({ data: { barbershopId: tenant, barberId: barber.id, barberName: "Diego", customerName: "Cliente", currency: "CLP", subtotal: base, discountAmount: "0", total: base, status, createdAt: new Date("2026-09-22T14:00:00Z"), items: { create: { description: "Corte histórico", unitPrice: base, subtotal: base } }, commission: { create: { barberId: barber.id, rate, baseAmount: base, amount } } } });
    await make("10000", "50", "5000"); await make("20000", "40", "8000"); await make("10000", "50", "5000", "VOIDED");
    let report = await getCommissions(db, tenant, period);
    assert.equal(report.sales.toString(), "30000"); assert.equal(report.pending.toString(), "13000");
    await assert.rejects(settleCommissions(db, other, input), /Barbero/);
    const concurrent = await Promise.allSettled([settleCommissions(db, tenant, input), settleCommissions(db, tenant, input)]);
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1, concurrent.map(r => r.status === "rejected" ? String(r.reason) : "ok").join("\n"));
    const paid = await db.commissionSettlement.findFirstOrThrow({ where: { barbershopId: tenant }, include: { items: true } });
    assert.equal(paid.totalSales.toString(), "30000"); assert.equal(paid.totalCommission.toString(), "13000"); assert.equal(paid.items.length, 2); assert.equal(paid.status, "PAID");
    const paymentPeriod = commissionPeriod("America/Santiago", {}, paid.paidAt!);
    assert.equal((await getCommissions(db, tenant, paymentPeriod)).paid.toString(), "13000");
    report = await getCommissions(db, tenant, period); assert.equal(report.pending.toString(), "0");
    await assert.rejects(settleCommissions(db, tenant, input), /No hay comisiones/);
    await db.barber.update({ where: { id: barber.id }, data: { commissionRate: "30", name: "Otro nombre" } });
    await db.saleItem.updateMany({ where: { barbershopId: tenant }, data: { description: "Descripción cambiada" } });
    await make("10000", "40", "4000");
    report = await getCommissions(db, tenant, period); assert.equal(report.pending.toString(), "4000");
    const history = await db.commissionSettlement.findUniqueOrThrow({ where: { id: paid.id }, include: { items: true } });
    assert.equal(history.totalCommission.toString(), "13000"); assert.equal(history.barberName, "Diego"); assert.ok(history.items.every(item => item.description === "Corte histórico"));
    assert.deepEqual(history.items.map(item => item.rate.toString()).sort(), ["40", "50"]);
    assert.equal((await getCommissions(db, other, period)).rows.length, 0);
    assert.equal(commissionPeriod("America/Santiago", { period: "custom", start: "2026-09-01", end: "2026-09-30" }).from.toISOString(), "2026-09-01T04:00:00.000Z");
    assert.equal(period.to.toISOString(), "2026-10-01T03:00:00.000Z");
    assert.throws(() => commissionPeriod("America/Santiago", { period: "custom", start: "2026-02-30", end: "2026-03-01" }));
    // An annulment after payment never rewrites or deletes the paid snapshot.
    await db.sale.updateMany({ where: { barbershopId: tenant }, data: { status: "VOIDED" } });
    assert.equal((await getCommissions(db, tenant, period)).pending.toString(), "0");
    assert.equal((await db.commissionSettlement.findUniqueOrThrow({ where: { id: paid.id } })).totalCommission.toString(), "13000");
    console.log("PASS snapshots, 13000 settlement, concurrency, double payment, new 4000 pending, voided, tenant isolation, timezone/DST, dates");
  } finally {
    const where = { barbershopId: { in: [tenant, other] } };
    await db.commissionSettlementItem.deleteMany({ where }); await db.commissionSettlement.deleteMany({ where });
    await db.commission.deleteMany({ where }); await db.saleItem.deleteMany({ where }); await db.sale.deleteMany({ where }); await db.barber.deleteMany({ where }); await db.barbershop.deleteMany({ where: { id: { in: [tenant, other] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
