import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getCustomerProfile } from "../src/lib/customer-profile";
import { utcToZonedParts } from "../src/lib/agenda";

const db = new PrismaClient();
const tenant = `profile-test-${randomUUID()}`;
const other = `profile-test-${randomUUID()}`;
const now = new Date("2030-09-23T12:00:00Z");
async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname));
  try {
    await db.barbershop.createMany({ data: [tenant, other].map(id => ({ id, slug: id, name: "Profile test" })) });
    const customer = await db.customer.create({ data: { barbershopId: tenant, name: "José test" } });
    const empty = await db.customer.create({ data: { barbershopId: tenant, name: "Empty" } });
    const barber = await db.barber.create({ data: { barbershopId: tenant, name: "Diego test" } });
    const service = await db.service.create({ data: { barbershopId: tenant, name: "Corte", price: "15500", durationMinutes: 30 } });
    const base = { barbershopId: tenant, customerId: customer.id, barberId: barber.id, serviceId: service.id, price: "15500" };
    for (let i = 0; i < 15; i++) {
      const startsAt = new Date(Date.UTC(2030, 8, i + 1, 14));
      const appointment = await db.appointment.create({ data: { ...base, startsAt, endsAt: new Date(startsAt.getTime() + 1800000), status: i < 12 ? "COMPLETED" : i < 14 ? "CANCELLED" : "NO_SHOW" } });
      if (i < 12) await db.sale.create({ data: { barbershopId: tenant, customerId: customer.id, barberId: barber.id, appointmentId: appointment.id, customerName: customer.name, barberName: barber.name, currency: "CLP", subtotal: "15500", total: "15500", discountAmount: "0", items: { create: { serviceId: service.id, description: "Corte histórico", unitPrice: "15500", subtotal: "15500" } } } });
    }
    await db.sale.create({ data: { barbershopId: tenant, customerId: customer.id, barberId: barber.id, customerName: customer.name, barberName: barber.name, currency: "CLP", subtotal: "99999", total: "99999", discountAmount: "0", status: "VOIDED" } });
    const a = await db.appointment.create({ data: { ...base, startsAt: new Date("2030-09-25T13:30:00Z"), endsAt: new Date("2030-09-25T14:00:00Z"), status: "CONFIRMED" } });
    const b = await db.appointment.create({ data: { ...base, startsAt: new Date("2030-09-26T13:30:00Z"), endsAt: new Date("2030-09-26T14:00:00Z") } });
    const pending = await Promise.all((["SCHEDULED", "CONFIRMED"] as const).map(status => db.appointment.create({ data: { ...base, status, startsAt: new Date("2030-09-22T14:00:00Z"), endsAt: new Date("2030-09-22T14:30:00Z") } })));
    const profile = await getCustomerProfile(db, tenant, customer.id, 1, now);
    assert.ok(profile);
    assert.equal(profile.counts.COMPLETED, 12);
    assert.equal(profile.counts.CANCELLED, 2);
    assert.equal(profile.counts.NO_SHOW, 1);
    assert.equal(profile.total.toString(), "186000");
    assert.equal(profile.average.toString(), "15500");
    assert.equal(profile.lastVisit?.toISOString(), "2030-09-12T14:00:00.000Z");
    assert.equal(profile.next?.id, a.id);
    assert.equal(profile.history.length, 10);
    assert.equal(profile.historyCount, 15);
    assert.equal(profile.frequentService?.count, 12);
    assert.equal(profile.frequentBarber?.count, 12);
    const page2 = await getCustomerProfile(db, tenant, customer.id, 2, now);
    assert.equal(page2?.history.length, 5);
    assert.equal(new Set([...profile.history, ...page2!.history].map(row => row.id)).size, 15);
    assert.ok([...profile.history, ...page2!.history].every(row => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(row.status)));
    assert.ok([...profile.history, ...page2!.history].every(row => !pending.some(item => item.id === row.id)));
    const unchanged = await db.appointment.findMany({ where: { barbershopId: tenant, id: { in: pending.map(row => row.id) } }, orderBy: { status: "asc" } });
    assert.equal(unchanged.length, 2);
    assert.deepEqual(unchanged.map(row => row.status).sort(), ["CONFIRMED", "SCHEDULED"]);
    assert.equal(await getCustomerProfile(db, other, customer.id, 1, now), null);
    assert.equal(await getCustomerProfile(db, tenant, "missing", 1, now), null);
    const blank = await getCustomerProfile(db, tenant, empty.id, 1, now);
    assert.equal(blank?.total.toString(), "0");
    assert.equal(blank?.average.toString(), "0");
    assert.equal(blank?.lastVisit, null);
    assert.equal(blank?.next, null);
    await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await db.service.update({ where: { id: service.id }, data: { price: "99000", name: "Renamed" } });
    const changed = await getCustomerProfile(db, tenant, customer.id, 1, now);
    assert.equal(changed?.next?.id, b.id);
    assert.equal(changed?.total.toString(), "186000");
    assert.equal(changed?.history.find(row => row.sale)?.sale?.items[0].description, "Corte histórico");
    assert.equal(utcToZonedParts(new Date("2030-09-26T01:00:00Z"), "America/Santiago").date, "2030-09-25");
    console.log("PASS: KPIs, ventas anuladas, historial paginado, tenant/404, vacío, próxima/cancelación, snapshots y timezone");
  } finally {
    await db.saleItem.deleteMany({ where: { barbershopId: tenant } });
    await db.sale.deleteMany({ where: { barbershopId: tenant } });
    await db.appointment.deleteMany({ where: { barbershopId: tenant } });
    await db.barbershop.deleteMany({ where: { id: { in: [tenant, other] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
