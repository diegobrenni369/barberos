import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, DayOfWeek } from "@prisma/client";
import bcrypt from "bcryptjs";
import { test as base, expect, type Page } from "@playwright/test";
import { utcToZonedParts, zonedDateTimeToUtc } from "../../src/lib/agenda";

export const db = new PrismaClient();
export async function createTenant() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL || '').hostname)) throw new Error('E2E requires local PostgreSQL');
  const slug = `e2e-${randomUUID()}`;
  const password = randomUUID();
  const user = await db.user.create({ data: { name: "Owner E2E", email: `${slug}@example.test`, passwordHash: await bcrypt.hash(password, 4) } });
  const shop = await db.barbershop.create({ data: { name: slug, slug, memberships: { create: { userId: user.id, role: "OWNER" } }, businessHours: { create: Object.values(DayOfWeek).map(dayOfWeek => ({ dayOfWeek, opensMinute: 480, closesMinute: 1200 })) } } });
  const barber = await db.barber.create({ data: { barbershopId: shop.id, name: "Profesional E2E", commissionRate: 50 } });
  const customer = await db.customer.create({ data: { barbershopId: shop.id, name: "Cliente E2E", phone: "+56911112222" } });
  const service = await db.service.create({ data: { barbershopId: shop.id, name: "Corte E2E", price: 10000, durationMinutes: 30, isOnlineBookingEnabled: true, barberServices: { create: { barberId: barber.id } } } });
  const tomorrow = utcToZonedParts(new Date(Date.now() + 86400_000), shop.timezone).date;
  const today = utcToZonedParts(new Date(), shop.timezone).date;
  async function appointment(time = "10:00", date = tomorrow) {
    const startsAt = zonedDateTimeToUtc(date, time, shop.timezone)!;
    return db.appointment.create({ data: { barbershopId: shop.id, barberId: barber.id, customerId: customer.id, serviceId: service.id, startsAt, endsAt: new Date(+startsAt + 1800_000), price: 10000 } });
  }
  return { user, password, shop, barber, customer, service, tomorrow, today, appointment };
}
export type Tenant = Awaited<ReturnType<typeof createTenant>>;
export async function cleanup(t: Tenant) {
  const where = { barbershopId: t.shop.id };
  await db.commissionSettlementItem.deleteMany({ where });
  await db.commissionSettlement.deleteMany({ where });
  await db.commission.deleteMany({ where });
  await db.payment.deleteMany({ where }); await db.saleItem.deleteMany({ where }); await db.sale.deleteMany({ where });
  await db.appointment.deleteMany({ where });
  await db.barbershop.delete({ where: { id: t.shop.id } }); await db.user.delete({ where: { id: t.user.id } });
}
export async function login(page: Page, t: Tenant) {
  await page.goto('/login'); await page.getByLabel('Correo').fill(t.user.email); await page.getByLabel('Contraseña').fill(t.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
}
export const test = base.extend<{ tenant: Tenant }>({
  tenant: async ({ page }, provide) => {
    page.on('pageerror', error => console.error('E2E client error:', error.message));
    const t = await createTenant();
    const bytes = randomUUID().replaceAll('-', '');
    await page.context().setExtraHTTPHeaders({ 'x-e2e-client-ip': `10.${parseInt(bytes.slice(0,2),16)}.${parseInt(bytes.slice(2,4),16)}.${parseInt(bytes.slice(4,6),16)}` });
    try { await provide(t); } finally { await cleanup(t); }
  },
});
export { expect };
