import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type AppointmentStatus } from "@prisma/client";
import { checkoutInTransaction, checkoutSchema, registerCheckout } from "../src/lib/checkout";
import { dayRangeUtc, utcToZonedParts } from "../src/lib/agenda";
import { getPaidAmount, getRemainingAmount, isSalePaid, getSalePaymentLabel } from "../src/lib/sale-balance";

// Dedicated, uniquely named test tenants; never uses seed customers or appointments.
const db = new PrismaClient();
const tenantId = `cash-test-${randomUUID()}`;
const otherId = `cash-test-${randomUUID()}`;
let checks = 0;
function passed(label: string) { checks++; console.log(`PASS ${label}`); }

async function main() {
  const databaseHost = new URL(process.env.DATABASE_URL ?? "").hostname;
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(databaseHost), "Integration fixtures may only run on local PostgreSQL");
  try {
    await db.barbershop.createMany({ data: [{ id: tenantId, name: "Cash test", slug: tenantId }, { id: otherId, name: "Cash test other", slug: otherId }] });
    const barber = await db.barber.create({ data: { barbershopId: tenantId, name: "Test barber", commissionRate: "50" } });
    const customer = await db.customer.create({ data: { barbershopId: tenantId, name: "Test customer" } });
    const service = await db.service.create({ data: { barbershopId: tenantId, name: "Corte clásico", price: "12000", durationMinutes: 30 } });
    const makeAppointment = (status: AppointmentStatus = "CONFIRMED", price = "12000") => db.appointment.create({ data: { barbershopId: tenantId, barberId: barber.id, customerId: customer.id, serviceId: service.id, startsAt: new Date("2026-09-22T13:00:00Z"), endsAt: new Date("2026-09-22T13:30:00Z"), price, status } });
    const input = (a: { id: string; updatedAt: Date }, discountAmount = "2000") => ({ appointmentId: a.id, expectedUpdatedAt: a.updatedAt.toISOString(), discountAmount, method: "DEBIT_CARD" as const });
    const appointment = await makeAppointment();
    const saleId = await registerCheckout(db, tenantId, input(appointment));
    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true, payments: true, commission: true } });
    assert.equal(sale.subtotal.toString(), "12000"); assert.equal(sale.discountAmount.toString(), "2000"); assert.equal(sale.total.toString(), "10000");
    assert.equal(sale.items.length, 1); assert.equal(sale.items[0].description, "Corte clásico"); assert.equal(sale.items[0].unitPrice.toString(), "12000");
    assert.equal(sale.payments.length, 1); assert.equal(sale.payments[0].method, "DEBIT_CARD"); assert.equal(sale.payments[0].amount.toString(), "10000");
    assert.equal(sale.commission?.rate.toString(), "50"); assert.equal(sale.commission?.baseAmount.toString(), "10000"); assert.equal(sale.commission?.amount.toString(), "5000");
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "COMPLETED");
    assert.ok([...sale.items, ...sale.payments, sale.commission].every(row => row?.barbershopId === tenantId));
    passed("12000 - 2000 = 10000, debit 10000, commission 5000, completed atomically");
    await assert.rejects(registerCheckout(db, tenantId, input(appointment)), /ya tiene una venta/); passed("already paid rejected");
    for (const status of ["CANCELLED", "NO_SHOW"] as const) { const a = await makeAppointment(status); await assert.rejects(registerCheckout(db, tenantId, input(a)), /cancelada o con inasistencia/); assert.equal(await db.sale.count({ where: { appointmentId: a.id } }), 0); passed(status); }
    const unpaid = await makeAppointment();
    for (const discount of ["-1", "12001", "1.5", "NaN"]) { await assert.rejects(registerCheckout(db, tenantId, input(unpaid, discount))); passed(`invalid discount ${discount}`); }
    await assert.rejects(registerCheckout(db, otherId, input(unpaid)), /no encontrada/); passed("cross tenant rejected");
    await assert.rejects(registerCheckout(db, tenantId, { ...input(unpaid), method: "INVALID" })); passed("invalid payment method rejected");
    await assert.rejects(registerCheckout(db, tenantId, { ...input(unpaid), expectedUpdatedAt: new Date(0).toISOString() }), /cambió/); passed("stale appointment rejected");
    await db.service.update({ where: { id: service.id }, data: { name: "Renamed", price: "25000" } });
    await db.barber.update({ where: { id: barber.id }, data: { commissionRate: "75", name: "Renamed barber" } });
    const historic = await db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true, commission: true } });
    assert.equal(historic.items[0].description, "Corte clásico"); assert.equal(historic.items[0].unitPrice.toString(), "12000"); assert.equal(historic.commission?.amount.toString(), "5000"); assert.equal(historic.commission?.rate.toString(), "50"); assert.equal(historic.barberName, "Test barber"); passed("historical snapshots unchanged");
    const historicalAppointment = await makeAppointment("COMPLETED");
    const historicalSaleId = await registerCheckout(db, tenantId, input(historicalAppointment));
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: historicalSaleId } })).subtotal.toString(), "12000");
    passed("legacy completed uses appointment price, not changed catalog price");
    const concurrent = await makeAppointment("SCHEDULED");
    const results = await Promise.allSettled([registerCheckout(db, tenantId, input(concurrent)), registerCheckout(db, tenantId, input(concurrent))]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await db.sale.count({ where: { appointmentId: concurrent.id } }), 1);
    const oneSale = await db.sale.findUniqueOrThrow({ where: { appointmentId: concurrent.id }, include: { payments: true, items: true, commission: true } });
    assert.equal(oneSale.payments.length, 1); assert.equal(oneSale.items.length, 1); assert.ok(oneSale.commission); passed("two concurrent submits produce exactly one sale/payment/commission");
    const rollback = await makeAppointment();
    await assert.rejects(db.$transaction(async tx => { await checkoutInTransaction(tx, tenantId, checkoutSchema.parse(input(rollback))); throw new Error("TEST_ROLLBACK"); }), /TEST_ROLLBACK/);
    assert.equal(await db.sale.count({ where: { appointmentId: rollback.id } }), 0);
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: rollback.id } })).status, "CONFIRMED"); passed("failure rolls back sale/items/payment/commission/status");
    await assert.rejects(db.payment.create({ data: { barbershopId: otherId, saleId, method: "CASH", amount: "1" } })); passed("composite foreign key prevents cross-tenant payment");
    const zero = await makeAppointment();
    const zeroId = await registerCheckout(db, tenantId, input(zero, "12000"));
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: zeroId } })).total.toString(), "0"); passed("full discount supports zero total");
    const rounded = await makeAppointment("CONFIRMED", "1");
    const roundedId = await registerCheckout(db, tenantId, input(rounded, "0"));
    assert.equal((await db.commission.findUniqueOrThrow({ where: { saleId: roundedId } })).amount.toString(), "1"); passed("Decimal commission rounds 0.75 CLP to one peso");
    for (const [date, hours] of [["2026-09-06", 23], ["2026-04-04", 25], ["2026-09-22", 24]] as const) {
      const range = dayRangeUtc(date, "America/Santiago");
      assert.equal((range.end.getTime() - range.start.getTime()) / 3600000, hours);
      assert.equal(utcToZonedParts(range.start, "America/Santiago").date, date);
      assert.equal(utcToZonedParts(new Date(range.end.getTime() - 1), "America/Santiago").date, date);
    }
    passed("daily timezone boundaries including Chile 23/25-hour DST days");
    const presencial = await makeAppointment("CONFIRMED", "20000");
    const presencialId = await registerCheckout(db, tenantId, { ...input(presencial, "0"), method: "CASH" });
    const presencialSale = await db.sale.findUniqueOrThrow({ where: { id: presencialId }, include: { payments: true } });
    assert.equal(getPaidAmount(presencialSale).toString(), "20000");
    assert.equal(getRemainingAmount(presencialSale).toString(), "0");
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: presencial.id } })).status, "COMPLETED");
    passed("A: presencial full payment completes attention");
    for (const amount of ["20000", "5000"]) {
      const future = await makeAppointment("CONFIRMED", "20000");
      await db.appointment.update({ where: { id: future.id }, data: { startsAt: new Date("2030-09-22T13:00:00Z"), endsAt: new Date("2030-09-22T13:30:00Z") } });
      // Representative existing method, no gateway or commission policy implied.
      const futureSale = await db.sale.create({ data: {
        barbershopId: tenantId, appointmentId: future.id, barberId: barber.id,
        customerId: customer.id, customerName: customer.name, barberName: barber.name,
        currency: "CLP", subtotal: "20000", discountAmount: "0", total: "20000",
        payments: { create: { method: "TRANSFER", amount } },
      }, include: { payments: true, commission: true } });
      assert.equal(getPaidAmount(futureSale).toString(), amount);
      assert.equal(getRemainingAmount(futureSale).toString(), amount === "5000" ? "15000" : "0");
      assert.equal(isSalePaid(futureSale), amount === "20000");
      assert.equal(futureSale.commission, null);
      assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: future.id } })).status, "CONFIRMED");
      passed(amount === "20000" ? "B: prepaid confirmed attention, no automatic commission" : "C: deposit leaves 15000 outstanding");
      if (amount === "5000") {
        await db.payment.create({ data: { barbershopId: tenantId, saleId: futureSale.id, method: "DEBIT_CARD", amount: "15000" } });
        const settled = await db.sale.findUniqueOrThrow({ where: { id: futureSale.id }, include: { payments: true } });
        assert.equal(settled.payments.length, 2);
        assert.equal(getPaidAmount(settled).toString(), "20000");
        assert.equal(getRemainingAmount(settled).toString(), "0");
        assert.ok(isSalePaid(settled));
        passed("D: two payments settle one sale");
      }
    }
    assert.equal(getSalePaymentLabel({ total: "20000", payments: [], status: "COMPLETED" }), "Pendiente de pago");
    assert.equal(getSalePaymentLabel({ total: "20000", payments: [{ amount: "5000" }], status: "COMPLETED" }), "Parcialmente pagada");
    assert.equal(getRemainingAmount({ total: "20000", payments: [{ amount: "20001" }] }).toString(), "0");
    assert.ok(isSalePaid({ total: "0", payments: [] }));
    assert.equal(getPaidAmount({ total: "0.3", payments: [{ amount: "0.1" }, { amount: "0.2" }] }).toString(), "0.3");
    passed("derived financial state, zero total, overpayment clamp and exact Decimal sums");
    await db.service.update({ where: { id: service.id }, data: { name: "Corte", price: "15000" } });
    await db.barber.update({ where: { id: barber.id }, data: { commissionRate: "50" } });
    const snapshotAppointment = await makeAppointment("CONFIRMED", "15000");
    const snapshotId = await registerCheckout(db, tenantId, input(snapshotAppointment, "5000"));
    await db.service.update({ where: { id: service.id }, data: { name: "Corte Premium", price: "20000" } });
    await db.barber.update({ where: { id: barber.id }, data: { commissionRate: "40" } });
    const snapshot = await db.sale.findUniqueOrThrow({ where: { id: snapshotId }, include: { items: true, commission: true } });
    assert.equal(snapshot.items[0].description, "Corte");
    assert.equal(snapshot.items[0].unitPrice.toString(), "15000");
    assert.equal(snapshot.commission?.rate.toString(), "50");
    assert.equal(snapshot.commission?.baseAmount.toString(), "10000");
    assert.equal(snapshot.commission?.amount.toString(), "5000");
    passed("Corte 15000 and 50% snapshot survives Corte Premium 20000 and 40%; discount net commission 5000");
    console.log(`${checks} integration checks passed`);
  } finally {
    // Only generated fixtures owned by this run, removed in FK order.
    await db.$transaction(async tx => {
      const where = { barbershopId: { in: [tenantId, otherId] } };
      await tx.commission.deleteMany({ where }); await tx.payment.deleteMany({ where }); await tx.saleItem.deleteMany({ where }); await tx.sale.deleteMany({ where });
      await tx.appointment.deleteMany({ where }); await tx.barber.deleteMany({ where }); await tx.service.deleteMany({ where }); await tx.customer.deleteMany({ where });
      await tx.barbershop.deleteMany({ where: { id: { in: [tenantId, otherId] } } });
    });
    await db.$disconnect();
    console.log("Dedicated test data cleaned up");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
