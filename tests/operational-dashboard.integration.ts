import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AppointmentStatus, Prisma, PrismaClient } from "@prisma/client";
import { getOperationalDashboard } from "../src/lib/operational-dashboard";
import { dayRangeUtc, utcToZonedParts, zonedDateTimeToUtc } from "../src/lib/agenda";
import { validSalesInRange } from "../src/lib/sales-report";

const db = new PrismaClient();
const tenant = `dashboard-test-${randomUUID()}`;
const foreign = `dashboard-test-${randomUUID()}`;
const timezone = "America/Santiago";
const date = "2030-09-23";
const at = (time: string, day = date) => zonedDateTimeToUtc(day, time, timezone);
const now = at("14:00");

async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname));
  try {
    await db.barbershop.createMany({ data: [tenant, foreign].map(id => ({ id, name: "Dashboard test", slug: id })) });
    const diego = await db.barber.create({ data: { barbershopId: tenant, name: "Diego" } });
    const juan = await db.barber.create({ data: { barbershopId: tenant, name: "Juan" } });
    const idle = await db.barber.create({ data: { barbershopId: tenant, name: "Sin actividad" } });
    const inactive = await db.barber.create({ data: { barbershopId: tenant, name: "Inactivo", isActive: false } });
    const customer = await db.customer.create({ data: { barbershopId: tenant, name: "Test" } });
    const service = await db.service.create({ data: { barbershopId: tenant, name: "Corte", price: "999999", durationMinutes: 30 } });
    const base = { barbershopId: tenant, customerId: customer.id, serviceId: service.id, price: "777777" };
    const statuses: AppointmentStatus[] = [...Array<AppointmentStatus>(8).fill("CONFIRMED"), ...Array<AppointmentStatus>(3).fill("SCHEDULED"), ...Array<AppointmentStatus>(5).fill("COMPLETED"), "CANCELLED", "CANCELLED", "NO_SHOW"];
    let completed = 0;
    for (const [i, status] of statuses.entries()) {
      const barberId = status === "COMPLETED" ? (completed++ < 3 ? diego.id : juan.id) : (i % 2 ? juan.id : diego.id);
      const startsAt = i === 0 ? at("14:30") : i === 1 ? at("15:00") : status === "SCHEDULED" || status === "CONFIRMED" ? at(`17:${i % 2 ? "30" : "00"}`) : at("10:00");
      await db.appointment.create({ data: { ...base, barberId, status, startsAt, endsAt: new Date(startsAt.getTime() + 1800000) } });
    }
    for (const [i, total] of [10000, 15000, 20000, 10000, 15000].entries()) {
      await db.sale.create({ data: { barbershopId: tenant, customerId: customer.id, barberId: [0, 1, 4].includes(i) ? diego.id : juan.id, customerName: "Snapshot", barberName: "Snapshot", currency: "CLP", subtotal: String(total), discountAmount: "0", total: String(total), createdAt: i === 0 ? at("23:30") : at("12:00") } });
    }
    await db.sale.create({ data: { barbershopId: tenant, barberId: diego.id, customerName: "Snapshot", barberName: "Snapshot", currency: "CLP", subtotal: "999", discountAmount: "0", total: "999", status: "VOIDED", createdAt: now } });
    // Calendar boundaries, zero days, and a preceding UTC date which is still yesterday locally.
    for (const day of ["2030-09-17", "2030-09-19", "2030-09-22"]) {
      await db.sale.create({ data: { barbershopId: tenant, barberId: diego.id, customerName: "Snapshot", barberName: "Snapshot", currency: "CLP", subtotal: "1234.50", discountAmount: "0", total: "1234.50", createdAt: at("23:30", day) } });
      await db.appointment.create({ data: { ...base, barberId: diego.id, status: "COMPLETED", startsAt: at("23:30", day), endsAt: at("23:45", day) } });
    }
    await db.appointment.create({ data: { ...base, barberId: juan.id, startsAt: at("00:00", "2030-09-24"), endsAt: at("00:30", "2030-09-24") } });
    const result = await getOperationalDashboard(db, tenant, timezone, now);
    assert.deepEqual(result.counts, { reservations: 19, active: 11, completed: 5, cancelled: 2, noShow: 1 });
    assert.equal(result.total.toString(), "70000");
    assert.equal(result.average.toString(), "14000");
    assert.equal(result.saleCount, 5);
    assert.equal(result.dailyAgenda.length, 6);
    assert.ok(result.dailyAgenda.every(row => ["COMPLETED", "SCHEDULED", "CONFIRMED"].includes(row.status) && utcToZonedParts(row.startsAt, timezone).date === date));
    assert.equal(result.team.find(row => row.id === diego.id)?.completed, 3);
    assert.equal(result.team.find(row => row.id === diego.id)?.sales.toString(), "40000");
    assert.equal(result.team.find(row => row.id === diego.id)?.next?.getTime(), at("14:30").getTime());
    assert.equal(result.team.find(row => row.id === juan.id)?.completed, 2);
    assert.equal(result.team.find(row => row.id === juan.id)?.sales.toString(), "30000");
    assert.equal(result.team.find(row => row.id === juan.id)?.next?.getTime(), at("15:00").getTime());
    assert.equal(result.team.find(row => row.id === idle.id)?.sales.toString(), "0");
    assert.equal(result.team.find(row => row.id === idle.id)?.next, null);
    assert.ok(!result.team.some(row => row.id === inactive.id));
    assert.deepEqual(result.trend.map(day => day.date), ["2030-09-17", "2030-09-18", "2030-09-19", "2030-09-20", "2030-09-21", "2030-09-22", date]);
    assert.deepEqual(result.trend.map(day => day.sales.toString()), ["1234.5", "0", "1234.5", "0", "0", "1234.5", "70000"]);
    assert.deepEqual(result.trend.map(day => day.completed), [1, 0, 1, 0, 0, 1, 5]);
    const range = dayRangeUtc(date, timezone);
    const cashSales = await db.sale.findMany({ where: validSalesInRange(tenant, range.start, range.end) });
    assert.ok(result.total.equals(cashSales.reduce((sum, sale) => sum.plus(sale.total), new Prisma.Decimal(0))));
    const empty = await getOperationalDashboard(db, foreign, timezone, now);
    assert.equal(empty.counts.reservations, 0);
    assert.equal(empty.total.toString(), "0");
    assert.equal(empty.average.toString(), "0");
    assert.equal(empty.team.length, 0);
    assert.equal(empty.dailyAgenda.length, 0);
    assert.ok(empty.trend.every(day => day.sales.isZero() && day.completed === 0));
    const late = await getOperationalDashboard(db, tenant, timezone, at("23:59"));
    assert.equal(late.dailyAgenda.length, 5);
    assert.ok(late.dailyAgenda.every(row => row.status === "COMPLETED"));
    assert.equal(result.remainingAgendaCount, 10);
    assert.equal(late.remainingAgendaCount, 11);
    assert.ok(result.dailyAgenda.every(row => row.status !== "COMPLETED" && row.startsAt >= now));
    assert.ok(result.dailyAgenda.every((row, i, rows) => i === 0 || rows[i - 1].startsAt <= row.startsAt));
    const tomorrow = await getOperationalDashboard(db, tenant, timezone, at("12:00", "2030-09-24"));
    assert.equal(tomorrow.counts.completed, 0);
    assert.equal(tomorrow.total.toString(), "0");
    assert.equal(tomorrow.trend[5].sales.toString(), "70000");
    // Seven calendar dates remain valid over the Chile DST transition.
    const dst = await getOperationalDashboard(db, foreign, timezone, at("12:00", "2026-09-08"));
    assert.equal(dst.trend[0].date, "2026-09-02");
    assert.equal(dst.trend[6].date, "2026-09-08");
    console.log("PASS Dashboard: 19/11/5/2/1, ventas 70000, ticket 14000, equipo, timezone, Caja, tendencia, tenant, vacío y DST");
  } finally {
    await db.sale.deleteMany({ where: { barbershopId: tenant } });
    await db.appointment.deleteMany({ where: { barbershopId: tenant } });
    await db.barbershop.deleteMany({ where: { id: { in: [tenant, foreign] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
