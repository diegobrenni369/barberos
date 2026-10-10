import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { findPublicAppointment, hashActionToken, issueAppointmentAccess, mockNotificationSender, processDueReminders, reminderPhone, respondToAppointment, syncAppointmentReminders, type NotificationSender } from "../src/lib/appointment-reminders";
import { zonedDateTimeToUtc } from "../src/lib/agenda";
import { ensureNoOverlap } from "../src/lib/appointment-overlap";

const db = new PrismaClient();
const tenant = `reminder-test-${randomUUID()}`;
const other = `reminder-test-${randomUUID()}`;
const timezone = "America/Santiago";
const at = (day: string, time: string) => zonedDateTimeToUtc(day, time, timezone);
const now = at("2030-09-29", "10:00");
let checks = 0;
function pass(label: string) { console.log(`PASS ${++checks}: ${label}`); }
async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname));
  try {
    await db.barbershop.createMany({ data: [tenant, other].map(id => ({ id, slug: id, name: "Reminders TEST", timezone })) });
    const barber = await db.barber.create({ data: { barbershopId: tenant, name: "Profesional test" } });
    const service = await db.service.create({ data: { barbershopId: tenant, name: "Corte test", price: 10000, durationMinutes: 30 } });
    const customer = await db.customer.create({ data: { barbershopId: tenant, name: "Cliente test", phone: "9 1111 1111" } });
    const make = (startsAt = at("2030-09-30", "15:30")) => db.$transaction(async tx => {
      const a = await tx.appointment.create({ data: { barbershopId: tenant, barberId: barber.id, customerId: customer.id, serviceId: service.id, price: 10000, startsAt, endsAt: new Date(+startsAt + 30 * 60_000), status: "CONFIRMED" } });
      await syncAppointmentReminders(tx, tenant, a.id, undefined, now);
      return a;
    });
    const a = await make();
    const rows = () => db.appointmentReminder.findMany({ where: { appointmentId: a.id }, orderBy: { scheduledFor: "asc" } });
    let reminders = await rows();
    assert.deepEqual(reminders.map(r => r.scheduledFor.toISOString()), [at("2030-09-29", "15:30"), at("2030-09-30", "13:30")].map(d => d.toISOString()));
    await db.$transaction(tx => syncAppointmentReminders(tx, tenant, a.id, undefined, now));
    assert.equal((await rows()).length, 2);
    pass("24h/2h scheduling, shop timezone and idempotency");
    const near = await make(new Date(+now + 60 * 60_000));
    assert.equal(await db.appointmentReminder.count({ where: { appointmentId: near.id } }), 0);
    const past = await make(new Date(+now - 60 * 60_000));
    assert.equal(await db.appointmentReminder.count({ where: { appointmentId: past.id } }), 0);
    const mid = await make(new Date(+now + 3 * 60 * 60_000));
    assert.equal(await db.appointmentReminder.count({ where: { appointmentId: mid.id } }), 1);
    await db.appointmentReminder.updateMany({ where: { appointmentId: mid.id }, data: { status: "CANCELLED", cancelledAt: now } });
    assert.equal(reminderPhone("9 1111 1111"), "+56911111111");
    assert.equal(reminderPhone("abc123"), null);
    assert.equal(reminderPhone(null), null);
    await db.customer.update({ where: { id: customer.id }, data: { phone: null } });
    const noPhone = await make();
    assert.equal(await db.appointmentReminder.count({ where: { appointmentId: noPhone.id } }), 0);
    await db.customer.update({ where: { id: customer.id }, data: { phone: "+56911111111" } });
    pass("past/near appointments, missing phone, shared phone normalization");

    const issue = (id = a.id) => db.$transaction(tx => issueAppointmentAccess(tx, tenant, id, now));
    const path = await issue();
    const token = path.split("/").at(-1)!;
    if (process.argv.includes("--preview")) {
      console.log(`Synthetic preview only: http://localhost:3000${path}`);
      console.log("Press Ctrl+C to remove this test tenant and its appointments.");
      process.stdin.resume();
      await new Promise<void>(resolve => process.once("SIGINT", resolve));
      process.stdin.pause();
      return;
    }
    assert.equal(token.length, 43);
    const access = await db.appointmentPublicAccess.findUniqueOrThrow({ where: { tokenHash: hashActionToken(token) } });
    assert.notEqual(access.tokenHash, token);
    assert.equal(+access.expiresAt, +a.startsAt);
    assert.ok(await findPublicAppointment(db, tenant, token, now));
    assert.equal(await findPublicAppointment(db, other, token, now), null);
    assert.equal(await findPublicAppointment(db, tenant, "x".repeat(43), now), null);
    assert.equal(await findPublicAppointment(db, tenant, token, a.startsAt), null);
    await assert.rejects(issue(past.id));
    assert.equal(await respondToAppointment(db, other, token, "confirm", now), false);
    await db.appointment.update({ where: { id: a.id }, data: { status: "SCHEDULED", customerConfirmedAt: null } });
    assert.equal(await respondToAppointment(db, tenant, token, "confirm", now), true);
    const firstConfirmation = await db.appointment.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(await respondToAppointment(db, tenant, token, "confirm", new Date(+now + 1000)), true);
    const confirmed = await db.appointment.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(+confirmed.customerConfirmedAt!, +now);
    assert.equal(+confirmed.updatedAt, +firstConfirmation.updatedAt);
    pass("secure token, hashing, tenant isolation, expiration and idempotent confirmation");
    await assert.rejects(db.appointmentPublicAccess.create({ data: { appointmentId: a.id, barbershopId: other, revision: 0, tokenHash: randomUUID(), expiresAt: a.startsAt } }));
    pass("composite tenant foreign key rejects cross-tenant link");
    const expiredToken = (await issue()).split("/").at(-1)!;
    await db.appointmentPublicAccess.update({ where: { tokenHash: hashActionToken(expiredToken) }, data: { expiresAt: now } });
    assert.equal(await findPublicAppointment(db, tenant, expiredToken, now), null);
    const revokedToken = (await issue()).split("/").at(-1)!;
    await db.appointmentPublicAccess.update({ where: { tokenHash: hashActionToken(revokedToken) }, data: { revokedAt: now } });
    assert.equal(await respondToAppointment(db, tenant, revokedToken, "cancel", now), false);
    pass("expired/revoked token cannot mutate a still-future appointment");

    const sentKeys = new Set<string>();
    const sender: NotificationSender = { async sendReminder(input) {
      assert.equal(input.data.localStartTime, "15:30");
      assert.equal(input.data.localDate, "2030-09-30");
      assert.ok(input.data.manageUrl.startsWith(`http://localhost:3000/book/${tenant}/manage/`));
      assert.ok(!sentKeys.has(input.idempotencyKey));
      sentKeys.add(input.idempotencyKey);
      return mockNotificationSender.sendReminder(input);
    } };
    const options = { sender, barbershopId: tenant, baseUrl: "http://localhost:3000", now: at("2030-09-29", "15:30") };
    await Promise.all([processDueReminders(db, options), processDueReminders(db, options)]);
    await processDueReminders(db, options);
    assert.equal(sentKeys.size, 1);
    assert.equal((await rows())[0].status, "SENT");
    pass("two workers + repeated processor: one mock send, timezone template data");

    await db.$transaction(async tx => {
      const before = await tx.appointment.findUniqueOrThrow({ where: { id: a.id } });
      await tx.appointment.update({ where: { id: a.id }, data: { startsAt: at("2030-09-30", "17:00"), endsAt: at("2030-09-30", "17:30") } });
      await syncAppointmentReminders(tx, tenant, a.id, before, at("2030-09-30", "10:00"));
    });
    reminders = await rows();
    assert.equal(reminders.filter(r => r.status === "SENT").length, 1);
    assert.equal(reminders.filter(r => r.status === "CANCELLED").length, 1);
    assert.deepEqual(reminders.filter(r => r.status === "SCHEDULED").map(r => r.scheduledFor.toISOString()), [at("2030-09-30", "15:00").toISOString()]);
    assert.equal(await findPublicAppointment(db, tenant, token, now), null);
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).customerConfirmedAt, null);
    pass("reschedule retains SENT, replaces future reminder, revokes token and confirmation");

    const freshToken = (await issue()).split("/").at(-1)!;
    assert.equal(await respondToAppointment(db, tenant, freshToken, "cancel", now), true);
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status, "CANCELLED");
    assert.equal((await rows()).filter(r => r.status === "SCHEDULED").length, 0);
    await ensureNoOverlap(db, tenant, barber.id, at("2030-09-30", "17:00"), at("2030-09-30", "17:30"));
    assert.equal(await findPublicAppointment(db, tenant, freshToken, now), null);
    pass("public cancellation cancels reminders, revokes access and frees slot");
    await db.$transaction(async tx => {
      const before = await tx.appointment.findUniqueOrThrow({ where: { id: a.id } });
      await tx.appointment.update({ where: { id: a.id }, data: { status: "SCHEDULED" } });
      await syncAppointmentReminders(tx, tenant, a.id, before, now);
    });
    await db.$transaction(tx => syncAppointmentReminders(tx, tenant, a.id, undefined, now));
    assert.equal((await rows()).filter(r => r.status === "SCHEDULED").length, 2);
    assert.equal((await rows()).filter(r => r.status === "SENT").length, 1);
    pass("restore creates fresh revision without reviving old rows or duplicates");
    for (const status of ["COMPLETED", "NO_SHOW"] as const) {
      const item = await make();
      await db.$transaction(async tx => {
        await tx.appointment.update({ where: { id: item.id }, data: { status } });
        await syncAppointmentReminders(tx, tenant, item.id, item, now);
      });
      assert.equal(await db.appointmentReminder.count({ where: { appointmentId: item.id, status: "SCHEDULED" } }), 0);
    }
    pass("COMPLETED and NO_SHOW cancel future reminders");
    const failure = await processDueReminders(db, { ...options, sender: { async sendReminder() { throw new Error("simulated"); } }, now: at("2030-09-30", "15:00") });
    assert.equal(failure.failed, 2);
    assert.equal((await processDueReminders(db, { ...options, now: at("2030-09-30", "15:00") })).sent, 0);
    pass("FAILED is explicit and never automatically resent");
    // DST uses elapsed hours from the resolved instant, not the host timezone.
    const dst = await make(at("2030-09-08", "15:30"));
    await db.$transaction(tx => syncAppointmentReminders(tx, tenant, dst.id, undefined, at("2030-09-01", "10:00")));
    const dstRows = await db.appointmentReminder.findMany({ where: { appointmentId: dst.id } });
    assert.ok(dstRows.some(r => +dst.startsAt - +r.scheduledFor === 24 * 60 * 60_000));
    pass("24h offset remains absolute across DST");
    // No secrets or customer payloads are logged by processor.
    console.log(`All ${checks} reminder checks passed.`);
  } finally {
    const where = { barbershopId: { in: [tenant, other] } };
    await db.appointmentPublicAccess.deleteMany({ where });
    await db.appointmentReminder.deleteMany({ where });
    await db.appointment.deleteMany({ where });
    await db.customer.deleteMany({ where });
    await db.service.deleteMany({ where });
    await db.barber.deleteMany({ where });
    await db.barbershop.deleteMany({ where: { id: { in: [tenant, other] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error); process.exitCode = 1; });
