import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { confirmPublicBooking, getPublicSlots, SLOT_TAKEN } from "../src/lib/public-booking";
import { serviceSchema } from "../src/lib/validations";
import { DAYS, ensureBarberAvailable, ensureNoBarberBlock, ensureNoBarberBreak } from "../src/lib/barber-availability";
import { ensureNoOverlap } from "../src/lib/appointment-overlap";
import { zonedDateTimeToUtc } from "../src/lib/agenda";

let queryCount = 0;
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
db.$on("query", () => queryCount++);
const tenantId = `public-test-${randomUUID()}`;
const otherId = `public-test-${randomUUID()}`;
const date = "2030-01-07"; // Monday, fixed clock for reproducibility.
const now = new Date("2030-01-07T09:00:00Z");
const timezone = "America/Santiago";
const at = (time: string, day = date) => zonedDateTimeToUtc(day, time, timezone);
let checks = 0;
function passed(message: string) { checks++; console.log(`PASS ${message}`); }

async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname), "Tests require local PostgreSQL");
  try {
    await db.barbershop.createMany({ data: [{ id: tenantId, slug: tenantId, name: "LUX Test" }, { id: otherId, slug: otherId, name: "Other test" }] });
    await db.barbershopBusinessHour.createMany({ data: [tenantId, otherId].flatMap(barbershopId => DAYS.map(dayOfWeek => ({ barbershopId, dayOfWeek, opensMinute: 480, closesMinute: 1080, isClosed: dayOfWeek === "SUNDAY" }))) });
    const service = await db.service.create({ data: { barbershopId: tenantId, name: "Corte", durationMinutes: 30, price: "12000", isOnlineBookingEnabled: true } });
    const diego = await db.barber.create({ data: { barbershopId: tenantId, name: "Diego" } });
    const juan = await db.barber.create({ data: { barbershopId: tenantId, name: "Juan" } });
    await db.barberService.createMany({ data: [diego, juan].map(barber => ({ barbershopId: tenantId, barberId: barber.id, serviceId: service.id })) });
    const customer = await db.customer.create({ data: { barbershopId: tenantId, name: "Existing private customer", phone: "+56 9 1111 1111" } });
    await db.barberAvailability.createMany({ data: DAYS.map(dayOfWeek => ({ barbershopId: tenantId, barberId: diego.id, dayOfWeek, startMinute: 540, endMinute: 1020 })) });
    await db.barberBreak.createMany({ data: DAYS.map(dayOfWeek => ({ barbershopId: tenantId, barberId: diego.id, dayOfWeek, startMinute: 780, endMinute: 840, label: "Private lunch label" })) });
    const reason = await db.blockReason.create({ data: { barbershopId: tenantId, name: "Private reason" } });
    await db.barberBlock.create({ data: { barbershopId: tenantId, barberId: diego.id, reasonId: reason.id, startsAt: at("15:00"), endsAt: at("16:00"), note: "Private note" } });
    const existing = await db.appointment.create({ data: { barbershopId: tenantId, barberId: juan.id, serviceId: service.id, customerId: customer.id, price: service.price, startsAt: at("10:00"), endsAt: at("10:30"), status: "CONFIRMED" } });
    if (process.argv.includes("--preview")) {
      console.log(`Preview fixture: http://localhost:3000/book/${tenantId}`);
      console.log("Press Ctrl+C to remove all preview data.");
      process.stdin.resume();
      await new Promise<void>(resolve => process.once("SIGINT", () => resolve()));
      process.stdin.pause();
      return;
    }
    const query = { slug: tenantId, serviceId: service.id, barberId: diego.id as string | null, date };
    const request = (time: string, barberId: string | null = diego.id, phone = "+56922222222") => ({ ...query, barberId, time, name: "José", phone, email: "" });
    queryCount = 0;
    const diegoSlots = await getPublicSlots(db, query, now);
    assert.ok(queryCount < 15, `Expected bulk loading, got ${queryCount} queries`);
    assert.ok(!diegoSlots.includes("08:00") && diegoSlots.includes("09:00") && !diegoSlots.includes("13:00") && !diegoSlots.includes("15:00") && !diegoSlots.includes("17:00"));
    passed("Diego effective hours, break, block and bounded bulk queries");
    const juanSlots = await getPublicSlots(db, { ...query, barberId: juan.id }, now);
    assert.ok(juanSlots.includes("08:00") && !juanSlots.includes("10:00") && juanSlots.includes("17:30"));
    const anySlots = await getPublicSlots(db, { ...query, barberId: null }, now);
    assert.deepEqual(anySlots, [...new Set([...diegoSlots, ...juanSlots])].sort());
    passed("Juan inherits business hours; ANY is union of real availability");
    for (const time of ["08:00", "09:00", "12:30", "13:00", "14:00", "15:00", "17:00"]) {
      let valid = true;
      const args = { barbershopId: tenantId, barberId: diego.id, startsAt: at(time), endsAt: new Date(at(time).getTime() + 30 * 60000), timezone };
      try { await ensureBarberAvailable(db, args); await ensureNoBarberBreak(db, args); await ensureNoBarberBlock(db, args); await ensureNoOverlap(db, tenantId, diego.id, args.startsAt, args.endsAt); } catch { valid = false; }
      assert.equal(diegoSlots.includes(time), valid);
    }
    passed("preloaded public checks agree with original database-backed Agenda checks");
    await db.service.update({ where: { id: service.id }, data: { durationMinutes: 60 } });
    assert.ok(!(await getPublicSlots(db, query, now)).includes("12:30"));
    await db.service.update({ where: { id: service.id }, data: { durationMinutes: 30 } });
    passed("full service duration cannot cross break");
    assert.deepEqual(await getPublicSlots(db, { ...query, date: "2030-01-13" }, now), []);
    await assert.rejects(confirmPublicBooking(db, { ...request("09:00"), date: "2030-01-13" }, now), /reservado/);
    await assert.rejects(getPublicSlots(db, { ...query, date: "2030-01-06" }, now));
    assert.ok(!(await getPublicSlots(db, query, at("09:01"))).includes("09:00"));
    passed("closed days and past dates/times rejected");
    const simultaneous = await Promise.allSettled([confirmPublicBooking(db, request("11:00"), now), confirmPublicBooking(db, request("11:00", diego.id, "+56933333333"), now)]);
    assert.equal(simultaneous.filter(item => item.status === "fulfilled").length, 1);
    const rejected = simultaneous.find(item => item.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason.message === SLOT_TAKEN);
    assert.equal(await db.appointment.count({ where: { barbershopId: tenantId, barberId: diego.id, startsAt: at("11:00") } }), 1);
    passed("same-slot concurrency: one appointment and friendly conflict");
    await confirmPublicBooking(db, request("14:00", diego.id), now);
    const reassigned = await confirmPublicBooking(db, request("14:00", null, "+56944444444"), now);
    assert.equal(reassigned.barber, "Juan");
    passed("ANY rechecks candidates and assigns other barber when original occupied");
    const twoAny = await Promise.allSettled([confirmPublicBooking(db, request("16:00", null, "+56955555555"), now), confirmPublicBooking(db, request("16:00", null, "+56966666666"), now)]);
    assert.equal(twoAny.filter(result => result.status === "fulfilled").length, 2);
    const assigned = await db.appointment.findMany({ where: { barbershopId: tenantId, startsAt: at("16:00") }, select: { barberId: true, source: true, status: true } });
    assert.equal(new Set(assigned.map(row => row.barberId)).size, 2);
    assert.ok(assigned.every(row => row.source === "ONLINE" && row.status === "CONFIRMED"));
    passed("concurrent ANY uses two real barbers through serializable retries");
    await confirmPublicBooking(db, request("11:30", diego.id, "9 1111 1111"), now);
    const reused = await db.appointment.findFirstOrThrow({ where: { barbershopId: tenantId, startsAt: at("11:30") } });
    assert.equal(reused.customerId, customer.id);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: customer.id } })).name, "Existing private customer");
    await confirmPublicBooking(db, request("12:00", diego.id, "+56 9 7777 7777"), now);
    await confirmPublicBooking(db, request("12:30", juan.id, "977777777"), now);
    assert.equal(await db.customer.count({ where: { barbershopId: tenantId, phone: "+56977777777" } }), 1);
    passed("phone normalization/reuse; unverified public submission never overwrites existing identity");
    await Promise.all([
      confirmPublicBooking(db, request("09:00", diego.id, "+56999999999"), now),
      confirmPublicBooking(db, request("09:30", juan.id, "999999999"), now),
    ]);
    assert.equal(await db.customer.count({ where: { barbershopId: tenantId, phone: "+56999999999" } }), 1);
    passed("concurrent same-phone bookings reuse one customer");
    const otherService = await db.service.create({ data: { barbershopId: otherId, name: "Other", price: "12000", durationMinutes: 30, isOnlineBookingEnabled: true } });
    const otherBarber = await db.barber.create({ data: { barbershopId: otherId, name: "Other" } });
    await db.barberService.create({ data: { barbershopId: otherId, barberId: otherBarber.id, serviceId: otherService.id } });
    await confirmPublicBooking(db, { ...request("09:00", otherBarber.id, "+56977777777"), slug: otherId, serviceId: otherService.id }, now);
    assert.equal(await db.customer.count({ where: { phone: "+56977777777" } }), 2);
    await assert.rejects(confirmPublicBooking(db, { ...request("09:00"), serviceId: otherService.id }, now));
    await assert.rejects(confirmPublicBooking(db, request("09:00", otherBarber.id), now));
    await assert.rejects(confirmPublicBooking(db, { ...request("09:00"), barbershopId: otherId }, now));
    passed("tenant isolation of service, barber, phone and rejected injected tenant");
    for (const onlinePaymentPolicy of ["OPTIONAL", "FULL", "DEPOSIT"] as const) {
      await db.service.update({ where: { id: service.id }, data: { onlinePaymentPolicy, depositAmount: onlinePaymentPolicy === "DEPOSIT" ? "5000" : null } });
      await assert.rejects(confirmPublicBooking(db, request("09:00"), now));
      await assert.rejects(getPublicSlots(db, query, now));
    }
    assert.equal(await db.sale.count({ where: { barbershopId: tenantId } }), 0);
    assert.equal(await db.payment.count({ where: { barbershopId: tenantId } }), 0);
    assert.equal(await db.commission.count({ where: { barbershopId: tenantId } }), 0);
    passed("payment policies never create fake sale/payment/commission");
    await db.service.update({ where: { id: service.id }, data: { onlinePaymentPolicy: "NONE", depositAmount: null, isOnlineBookingEnabled: false } });
    await assert.rejects(confirmPublicBooking(db, request("09:00"), now));
    await db.service.update({ where: { id: service.id }, data: { isOnlineBookingEnabled: true, isActive: false } });
    await assert.rejects(confirmPublicBooking(db, request("09:00"), now));
    await db.service.update({ where: { id: service.id }, data: { isActive: true } });
    await db.barbershop.update({ where: { id: tenantId }, data: { isActive: false } });
    await assert.rejects(confirmPublicBooking(db, request("09:00"), now));
    await db.barbershop.update({ where: { id: tenantId }, data: { isActive: true } });
    passed("disabled/unpublished services and inactive tenant rejected at confirmation");
    const config = { name: "Corte", durationMinutes: 30, price: "12000", onlinePaymentPolicy: "DEPOSIT" };
    assert.equal(serviceSchema.parse({ ...config, depositAmount: "5000", isActive: "false" }).isActive, false);
    assert.ok(serviceSchema.safeParse({ ...config, depositAmount: "5000" }).success);
    for (const depositAmount of ["0", "12001", "-1", "", "invalid", "NaN"]) assert.equal(serviceSchema.safeParse({ ...config, depositAmount }).success, false);
    assert.equal(serviceSchema.safeParse({ ...config, depositAmount: "5000", price: "invalid" }).success, false);
    assert.equal(serviceSchema.safeParse({ ...config, onlinePaymentPolicy: "NONE", depositAmount: "5000" }).success, false);
    passed("backoffice deposit validation and policy applicability");
    await db.appointment.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
    assert.ok((await getPublicSlots(db, { ...query, barberId: juan.id }, now)).includes("10:00"));
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: existing.id } })).source, "INTERNAL");
    passed("cancelled appointment frees slot; existing internal source unchanged");
    console.log(`${checks} public booking integration checks passed`);
  } finally {
    await db.$transaction(async tx => {
      const where = { barbershopId: { in: [tenantId, otherId] } };
      await tx.appointment.deleteMany({ where }); await tx.barberBlock.deleteMany({ where });
      await tx.barberBreak.deleteMany({ where }); await tx.barberAvailability.deleteMany({ where });
      await tx.barber.deleteMany({ where }); await tx.customer.deleteMany({ where }); await tx.service.deleteMany({ where });
      await tx.blockReason.deleteMany({ where }); await tx.barbershopBusinessHour.deleteMany({ where });
      await tx.barbershop.deleteMany({ where: { id: { in: [tenantId, otherId] } } });
    });
    await db.$disconnect();
    console.log("Dedicated test data cleaned up");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
