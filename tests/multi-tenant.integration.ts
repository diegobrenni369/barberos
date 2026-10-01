import "dotenv/config";
import assert from "node:assert/strict";
import { createTenant, cleanup, db } from "./e2e/fixtures";
import { getCustomerProfile } from "../src/lib/customer-profile";
import { getCommissions, commissionPeriod, settleCommissions } from "../src/lib/commissions";
import { registerCheckout } from "../src/lib/checkout";
import { confirmPublicBooking, getPublicSlots } from "../src/lib/public-booking";
import { moveAppointmentInTransaction } from "../src/lib/move-appointment";
import { issueAppointmentAccess, findPublicAppointment, syncAppointmentReminders, processDueReminders } from "../src/lib/appointment-reminders";

async function main() {
  const a = await createTenant(), b = await createTenant();
  try {
    const aa = await a.appointment(), ab = await b.appointment();
    assert.equal(await getCustomerProfile(db, a.shop.id, b.customer.id), null);
    const input = { slug: a.shop.slug, serviceId: b.service.id, barberId: a.barber.id, date: a.tomorrow, time: '10:00', name: 'Test', phone: '+56922223333', email: '' };
    await assert.rejects(confirmPublicBooking(db, input));
    await assert.rejects(confirmPublicBooking(db, { ...input, serviceId: a.service.id, barberId: b.barber.id }));
    await assert.rejects(getPublicSlots(db, { slug: a.shop.slug, serviceId: b.service.id, barberId: null, date: a.tomorrow }));
    await assert.rejects(db.$transaction(tx => moveAppointmentInTransaction(tx, { barbershopId: a.shop.id, timezone: a.shop.timezone }, { id: ab.id, barberId: a.barber.id, date: a.tomorrow, time: '11:00', expectedUpdatedAt: ab.updatedAt.toISOString() })));
    await assert.rejects(registerCheckout(db, a.shop.id, { appointmentId: ab.id, expectedUpdatedAt: ab.updatedAt.toISOString(), discountAmount: '0', method: 'CASH' }));
    await registerCheckout(db, b.shop.id, { appointmentId: ab.id, expectedUpdatedAt: ab.updatedAt.toISOString(), discountAmount: '0', method: 'CASH' });
    const period = commissionPeriod(a.shop.timezone, {});
    const summary = await getCommissions(db, a.shop.id, period);
    assert.equal(summary.rows.length, 0); assert.equal(summary.sales.toString(), '0');
    await assert.rejects(settleCommissions(db, a.shop.id, { barberId: b.barber.id, start: period.start, end: period.end }));
    const future = await b.appointment('12:00');
    await assert.rejects(db.$transaction(tx => issueAppointmentAccess(tx, a.shop.id, future.id)));
    const path = await db.$transaction(tx => issueAppointmentAccess(tx, b.shop.id, future.id));
    assert.equal(await findPublicAppointment(db, a.shop.slug, path.split('/').at(-1)!), null);
    await db.$transaction(tx => syncAppointmentReminders(tx, b.shop.id, future.id));
    const before = await db.appointmentReminder.findMany({ where: { barbershopId: b.shop.id } });
    await processDueReminders(db, { barbershopId: a.shop.id });
    assert.deepEqual(await db.appointmentReminder.findMany({ where: { barbershopId: b.shop.id } }), before);
    assert.deepEqual(await db.appointment.findUniqueOrThrow({ where: { id: aa.id } }), aa);
    console.log('PASS dedicated A/B isolation: customer profile, service, barber, move, checkout, financial report, settlement, access token, reminder worker');
  } finally { await cleanup(a); await cleanup(b); await db.$disconnect(); }
}
main().catch(() => { console.error('Multi-tenant test failed'); process.exitCode = 1; });
