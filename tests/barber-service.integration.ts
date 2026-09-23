import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { ensureBarberService, setServiceBarbers } from "../src/lib/barber-service";
import { confirmPublicBooking, getPublicSlots } from "../src/lib/public-booking";
import { moveAppointmentInTransaction } from "../src/lib/move-appointment";
import { DAYS } from "../src/lib/barber-availability";
import { zonedDateTimeToUtc } from "../src/lib/agenda";

const db = new PrismaClient();
const tenantId = `eligibility-test-${randomUUID()}`;
const otherId = `eligibility-test-${randomUUID()}`;
const date = "2030-01-07";
const timezone = "America/Santiago";
const now = new Date("2030-01-07T09:00:00Z");
const at = (time: string) => zonedDateTimeToUtc(date, time, timezone);
const serial = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
let checks = 0;
const passed = (label: string) => { checks++; console.log(`PASS ${label}`); };

async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname));
  try {
    await db.barbershop.createMany({ data: [tenantId, otherId].map(id => ({ id, slug: id, name: "Eligibility test" })) });
    await db.barbershopBusinessHour.createMany({ data: DAYS.map(dayOfWeek => ({ barbershopId: tenantId, dayOfWeek, opensMinute: 480, closesMinute: 1080 })) });
    const diego = await db.barber.create({ data: { barbershopId: tenantId, name: "Diego" } });
    const juan = await db.barber.create({ data: { barbershopId: tenantId, name: "Juan" } });
    const esteban = await db.barber.create({ data: { barbershopId: tenantId, name: "Esteban" } });
    const foreign = await db.barber.create({ data: { barbershopId: otherId, name: "Foreign" } });
    const a = await db.service.create({ data: { barbershopId: tenantId, name: "Service A", durationMinutes: 30, price: "12000", isOnlineBookingEnabled: true } });
    const b = await db.service.create({ data: { barbershopId: tenantId, name: "Service B", durationMinutes: 30, price: "15000", isOnlineBookingEnabled: true } });
    const foreignService = await db.service.create({ data: { barbershopId: otherId, name: "Foreign", durationMinutes: 30, price: "1" } });
    const customer = await db.customer.create({ data: { barbershopId: tenantId, name: "Test client", phone: "+56900000000" } });
    await serial(tx => setServiceBarbers(tx, tenantId, a.id, [diego.id, juan.id], true));
    await serial(tx => setServiceBarbers(tx, tenantId, b.id, [esteban.id], true));
    for (const [service, ids] of [[a, [diego.id, juan.id]], [b, [esteban.id]]] as const) {
      const eligible = await db.barber.findMany({ where: { barbershopId: tenantId, isActive: true, barberServices: { some: { barbershopId: tenantId, serviceId: service.id } } }, select: { id: true } });
      assert.deepEqual(eligible.map(row => row.id).sort(), [...ids].sort());
    }
    passed("service A -> Diego/Juan; service B -> Esteban only");

    await assert.rejects(serial(tx => setServiceBarbers(tx, tenantId, a.id, [foreign.id], true)), /tu barbería/);
    await assert.rejects(serial(tx => setServiceBarbers(tx, otherId, a.id, [foreign.id], true)), /no encontrado/);
    for (const barbershopId of [tenantId, otherId]) {
      await assert.rejects(db.barberService.create({ data: { barbershopId, barberId: diego.id, serviceId: foreignService.id } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003");
    }
    await assert.rejects(db.barberService.create({ data: { barbershopId: tenantId, barberId: diego.id, serviceId: a.id } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");
    passed("cross-tenant associations rejected by application and both database FKs; duplicate rejected");

    const query = { slug: tenantId, serviceId: a.id, barberId: null as string | null, date };
    const request = (time: string, barberId: string | null = null) => ({ ...query, barberId, time, name: "Test client", phone: "+56900000000", email: "" });
    assert.deepEqual(await getPublicSlots(db, { ...query, barberId: esteban.id }, now), []);
    await assert.rejects(confirmPublicBooking(db, request("09:00", esteban.id), now));
    await assert.rejects(serial(async tx => {
      await ensureBarberService(tx, tenantId, esteban.id, a.id);
      await tx.appointment.create({ data: { barbershopId: tenantId, barberId: esteban.id, serviceId: a.id, customerId: customer.id, startsAt: at("09:00"), endsAt: at("09:30"), price: a.price } });
    }), /BARBER_SERVICE_INELIGIBLE/);
    assert.equal(await db.appointment.count({ where: { barbershopId: tenantId } }), 0);
    passed("ineligible specific slots empty; public confirmation and backoffice eligibility guard reject creation");

    await db.barberBreak.createMany({ data: [diego, juan].map(barber => ({ barbershopId: tenantId, barberId: barber.id, dayOfWeek: "MONDAY", startMinute: 780, endMinute: 840 })) });
    const anySlots = await getPublicSlots(db, query, now);
    const slots = await Promise.all([diego, juan].map(barber => getPublicSlots(db, { ...query, barberId: barber.id }, now)));
    assert.deepEqual(anySlots, [...new Set(slots.flat())].sort());
    assert.ok(!anySlots.includes("13:00")); // Esteban is free, but cannot perform A.
    assert.ok((await getPublicSlots(db, { ...query, serviceId: b.id }, now)).includes("13:00"));
    passed("ANY union includes only eligible professionals, never free but ineligible Esteban");

    const simultaneous = await Promise.all([confirmPublicBooking(db, request("09:00"), now), confirmPublicBooking(db, request("09:00"), now)]);
    assert.deepEqual(simultaneous.map(row => row.barber).sort(), ["Diego", "Juan"]);
    await assert.rejects(confirmPublicBooking(db, request("09:00"), now));
    const deterministic = await confirmPublicBooking(db, request("10:00"), now);
    assert.equal(deterministic.barber, [diego, juan].sort((x, y) => x.id.localeCompare(y.id))[0].name);
    passed("concurrent ANY assigns two eligible barbers; deterministic ID order; no fallback to Esteban");

    const appointment = await db.appointment.findFirstOrThrow({ where: { barbershopId: tenantId, startsAt: at("10:00") } });
    const move = (barberId: string, time: string, id = appointment.id, expectedUpdatedAt = appointment.updatedAt.toISOString()) => serial(tx => moveAppointmentInTransaction(tx, { barbershopId: tenantId, timezone }, { id, barberId, date, time, expectedUpdatedAt }));
    await assert.rejects(move(esteban.id, "11:00"), /BARBER_SERVICE_INELIGIBLE/);
    assert.deepEqual(await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } }), appointment);
    await assert.rejects(move(juan.id, "13:00"), /BARBER_BREAK/);
    await assert.rejects(move(juan.id, "07:30"), /OUTSIDE_BUSINESS_HOURS/);
    await assert.rejects(move(juan.id, "09:00"), /APPOINTMENT_OVERLAP/);
    const reason = await db.blockReason.create({ data: { barbershopId: tenantId, name: "Test absence" } });
    await db.barberBlock.create({ data: { barbershopId: tenantId, barberId: juan.id, reasonId: reason.id, startsAt: at("14:00"), endsAt: at("15:00") } });
    await assert.rejects(move(juan.id, "14:00"), /BARBER_BLOCKED/);
    await db.barberAvailability.create({ data: { barbershopId: tenantId, barberId: juan.id, dayOfWeek: "MONDAY", startMinute: 480, endMinute: 1020 } });
    await assert.rejects(move(juan.id, "17:00"), /OUTSIDE_AVAILABILITY/);
    await move(juan.id, "11:00");
    const moved = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    assert.equal(moved.barberId, juan.id); assert.equal(moved.startsAt.getTime(), at("11:00").getTime());
    assert.equal(moved.endsAt.getTime() - moved.startsAt.getTime(), 30 * 60000);
    await assert.rejects(move(diego.id, "12:00"), /STALE_APPOINTMENT/);
    passed("drag eligibility rollback; overlap/break/block/hours/custom hours regression; valid move persisted and duration intact");

    await assert.rejects(serial(tx => setServiceBarbers(tx, tenantId, a.id, [], true)), /al menos un/);
    assert.equal(await db.barberService.count({ where: { serviceId: a.id } }), 2);
    await serial(async tx => {
      await tx.service.update({ where: { id: b.id }, data: { isOnlineBookingEnabled: false } });
      await setServiceBarbers(tx, tenantId, b.id, [], false);
    });
    assert.equal(await db.barberService.count({ where: { serviceId: b.id } }), 0);
    passed("online service requires active selection; administrative service permits zero");

    await serial(tx => setServiceBarbers(tx, tenantId, a.id, [diego.id], true));
    assert.deepEqual(await db.appointment.findUniqueOrThrow({ where: { id: moved.id } }), moved);
    await assert.rejects(move(juan.id, "12:00", moved.id, moved.updatedAt.toISOString()), /BARBER_SERVICE_INELIGIBLE/);
    assert.deepEqual(await getPublicSlots(db, { ...query, barberId: juan.id }, now), []);
    await assert.rejects(confirmPublicBooking(db, request("12:00", juan.id), now));
    passed("removing eligibility leaves existing appointment unchanged; new moves and stale public selection rejected");

    await db.barber.update({ where: { id: diego.id }, data: { isActive: false } });
    await serial(tx => setServiceBarbers(tx, tenantId, a.id, [], false));
    assert.equal(await db.barberService.count({ where: { serviceId: a.id, barberId: diego.id } }), 1);
    assert.deepEqual(await getPublicSlots(db, query, now), []);
    await assert.rejects(serial(tx => setServiceBarbers(tx, tenantId, a.id, [diego.id], true)), /activos/);
    await db.barber.update({ where: { id: diego.id }, data: { isActive: true } });
    assert.ok((await getPublicSlots(db, query, now)).length > 0);
    await db.service.update({ where: { id: a.id }, data: { isActive: false } });
    await assert.rejects(getPublicSlots(db, query, now));
    assert.equal(await db.barberService.count({ where: { serviceId: a.id } }), 1);
    passed("inactive associations retained; inactive professionals/services excluded; reactivation restores eligibility");
    console.log(`${checks} eligibility integration groups passed`);
  } finally {
    await db.$transaction(async tx => {
      const where = { barbershopId: { in: [tenantId, otherId] } };
      await tx.appointment.deleteMany({ where }); await tx.barberBlock.deleteMany({ where });
      await tx.barberBreak.deleteMany({ where }); await tx.barberAvailability.deleteMany({ where });
      await tx.barberService.deleteMany({ where }); await tx.barber.deleteMany({ where });
      await tx.service.deleteMany({ where }); await tx.customer.deleteMany({ where });
      await tx.blockReason.deleteMany({ where }); await tx.barbershopBusinessHour.deleteMany({ where });
      await tx.barbershop.deleteMany({ where: { id: { in: [tenantId, otherId] } } });
    });
    await db.$disconnect();
    console.log("Dedicated eligibility fixtures cleaned up");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
