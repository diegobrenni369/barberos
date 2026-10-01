import { test, expect, db, login, createTenant, cleanup, type Tenant } from './fixtures';
import type { Page } from '@playwright/test';
import { issueAppointmentAccess } from '../../src/lib/appointment-reminders';
import { dayOfWeekForDate } from '../../src/lib/barber-availability';

async function prepareBooking(page: Page, t: Tenant, name = 'Visitante E2E') {
  await page.goto(`/book/${t.shop.slug}`);
  await page.getByRole('button', { name: /Corte E2E/ }).click();
  await page.getByRole('button', { name: t.barber.name, exact: true }).click();
  const target = new Date(`${t.tomorrow}T12:00:00`);
  const day = page.locator(`button[data-day="${target.toLocaleDateString('es')}"]`);
  if (!await day.count()) await page.getByRole('button', { name: /mes siguiente|next month/i }).click();
  await day.click(); await page.getByRole('button', { name: '10:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(name); await page.getByLabel('Teléfono', { exact: true }).fill('+56922223333');
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar reserva', exact: true })).toBeVisible();
}

test('auth, tenant, ruta privada y logout', async ({ page, tenant }) => {
  await page.goto('/cash'); await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Correo').fill(tenant.user.email); await page.getByLabel('Contraseña').fill('incorrecta'); await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible();
  await login(page, tenant); await expect(page.getByText(tenant.shop.name).first()).toBeVisible();
  await page.getByRole('button', { name: /Owner E2E/ }).click();
  await page.getByText('Cerrar sesión', { exact: true }).click(); await expect(page).toHaveURL(/\/login/);
});

test('booking completo y concurrencia del mismo slot', async ({ page, tenant, browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', extraHTTPHeaders: { 'x-e2e-client-ip': '10.250.250.250' } });
  const second = await context.newPage();
  await prepareBooking(page, tenant); await prepareBooking(second, tenant, 'Otro visitante');
  await Promise.all([page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click(), second.getByRole('button', { name: 'Confirmar reserva', exact: true }).click()]);
  await expect.poll(() => db.appointment.count({ where: { barbershopId: tenant.shop.id } })).toBe(1);
  await expect.poll(async () => (await page.getByText('Tu reserva está confirmada').count()) + (await second.getByText('Tu reserva está confirmada').count())).toBe(1);
  const loser = await page.getByText('Tu reserva está confirmada').count() ? second : page;
  await expect(loser.getByRole('alert')).toContainText(/reservado|horario/);
  const a = await db.appointment.findFirstOrThrow({ where: { barbershopId: tenant.shop.id } });
  expect(a.source).toBe('ONLINE'); expect(a.status).toBe('CONFIRMED');
  await login(page, tenant); await page.goto(`/agenda?date=${tenant.tomorrow}`); await expect(page.getByRole('button', { name: /Visitante|Otro visitante/i }).first()).toBeVisible();
  await context.close();
});

test('agenda crear, editar, cancelar y restaurar', async ({ page, tenant }) => {
  await login(page, tenant); await page.goto(`/agenda?date=${tenant.tomorrow}`);
  await page.getByRole('button', { name: 'Nueva reserva', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.locator('input[name="time"]').fill('09:00');
  await dialog.getByRole('button', { name: 'Guardar reserva' }).click();
  await expect.poll(() => db.appointment.count({ where: { barbershopId: tenant.shop.id } })).toBe(1);
  await page.getByRole('button', { name: /Cliente E2E/ }).first().click(); await page.getByRole('button', { name: 'Editar reserva' }).click();
  await dialog.locator('input[name="time"]').fill('10:00'); await dialog.getByRole('button', { name: 'Guardar reserva' }).click();
  await expect(page.getByRole('button', { name: /Cliente E2E.*10:00/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Cliente E2E.*10:00/ }).first().click(); await page.getByRole('button', { name: 'Acciones de la reserva' }).click();
  await page.getByRole('menuitem', { name: 'Cancelar reserva' }).click();
  await expect.poll(async () => (await db.appointment.findFirstOrThrow({ where: { barbershopId: tenant.shop.id } })).status).toBe('CANCELLED');
  await page.goto(`/agenda?date=${tenant.tomorrow}&cancelled=true`); await page.getByRole('button', { name: /Cliente E2E/ }).first().click();
  await page.getByRole('button', { name: 'Acciones de la reserva' }).click(); await page.getByRole('menuitem', { name: 'Restaurar reserva' }).click();
  await expect.poll(async () => (await db.appointment.findFirstOrThrow({ where: { barbershopId: tenant.shop.id } })).status).toBe('SCHEDULED');
});

test('drag válido persiste y drop ocupado mantiene la reserva original', async ({ page, tenant }) => {
  const a = await tenant.appointment('09:00'); await tenant.appointment('11:00');
  await login(page, tenant); await page.goto(`/agenda?date=${tenant.tomorrow}`);
  async function drag(time: string, dy: number) {
    const card = page.getByRole('button', { name: new RegExp(`Cliente E2E.*${time}`) }).first();
    await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox(); expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2, y = box!.y + 8;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 10, y, { steps: 5 });
    await page.mouse.move(x, y + dy, { steps: 20 }); await page.mouse.up();
  }
  await drag('09:00', 96);
  await expect.poll(async () => (await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).startsAt.getTime()).toBe(+a.startsAt + 3600_000);
  await page.reload(); await expect(page.getByRole('button', { name: /Cliente E2E.*10:00/ }).first()).toBeVisible();
  await drag('10:00', 96); await expect(page.getByText('No disponible en ese horario. La reserva no se movió.', { exact: true })).toBeVisible();
  expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).startsAt.getTime()).toBe(+a.startsAt + 3600_000);
});

test('disponibilidad rechaza descanso, bloqueo y horario alterado server-side', async ({ page, tenant }) => {
  const dayOfWeek = dayOfWeekForDate(tenant.tomorrow);
  await db.barberBreak.create({ data: { barbershopId: tenant.shop.id, barberId: tenant.barber.id, dayOfWeek, startMinute: 600, endMinute: 630, label: 'Descanso E2E' } });
  const reason = await db.blockReason.create({ data: { barbershopId: tenant.shop.id, name: 'Ausencia E2E' } });
  const blocker = await tenant.appointment('11:00'); await db.appointment.delete({ where: { id: blocker.id } });
  await db.barberBlock.create({ data: { barbershopId: tenant.shop.id, barberId: tenant.barber.id, startsAt: blocker.startsAt, endsAt: blocker.endsAt, reasonId: reason.id } });
  await db.barberAvailability.create({ data: { barbershopId: tenant.shop.id, barberId: tenant.barber.id, dayOfWeek, startMinute: 540, endMinute: 1080 } });
  const response = await page.request.get(`/api/book/${tenant.shop.slug}/slots?service=${tenant.service.id}&barber=${tenant.barber.id}&date=${tenant.tomorrow}`);
  const { slots } = await response.json(); expect(slots).not.toContain('08:00'); expect(slots).not.toContain('10:00'); expect(slots).not.toContain('11:00'); expect(slots).not.toContain('19:00');
  await login(page, tenant);
  for (const time of ['07:00', '08:00', '10:00', '11:00']) {
    await page.goto(`/agenda?date=${tenant.tomorrow}`); await page.getByRole('button', { name: 'Nueva reserva', exact: true }).click();
    await page.getByRole('dialog').locator('input[name="time"]').fill(time); await page.getByRole('button', { name: 'Guardar reserva' }).click();
    await expect(page).toHaveURL(/error=/); expect(await db.appointment.count({ where: { barbershopId: tenant.shop.id } })).toBe(0);
  }
});

test('cobro, Cliente 360 y liquidación', async ({ page, tenant }) => {
  const a = await tenant.appointment('08:00', tenant.today);
  await login(page, tenant); await page.goto(`/agenda?date=${tenant.today}`); await page.getByRole('button', { name: /Cliente E2E/ }).first().click();
  await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Método de pago' }).click(); await page.getByRole('option', { name: 'Efectivo', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect.poll(() => db.sale.count({ where: { appointmentId: a.id } })).toBe(1);
  const sale = await db.sale.findUniqueOrThrow({ where: { appointmentId: a.id }, include: { items: true, payments: true, commission: true } });
  expect(sale.items).toHaveLength(1); expect(sale.payments).toHaveLength(1); expect(sale.commission?.amount.toString()).toBe('5000');
  expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('COMPLETED');
  await page.goto('/cash'); await expect(page.getByText('Cliente E2E').first()).toBeVisible();
  await page.goto(`/customers/${tenant.customer.id}`); await expect(page.getByRole('heading', { name: 'Cliente E2E' })).toBeVisible();
  await expect(page.getByText('$10.000').first()).toBeVisible(); await expect(page.getByText('Completada').first()).toBeVisible();
  await page.goto('/commissions'); await page.getByRole('button', { name: 'Ver detalle' }).first().click();
  await page.getByRole('button', { name: 'Marcar comisión como pagada' }).click(); await page.getByRole('button', { name: 'Confirmar pago realizado' }).click();
  await expect.poll(() => db.commissionSettlement.count({ where: { barbershopId: tenant.shop.id } })).toBe(1);
  await expect(page.getByRole('button', { name: 'Marcar comisión como pagada' })).toHaveCount(0);
});

test('enlace público confirma, cancela y revoca', async ({ page, tenant }) => {
  const a = await tenant.appointment();
  const link = await db.$transaction(tx => issueAppointmentAccess(tx, tenant.shop.id, a.id));
  await page.goto(link); await page.getByRole('button', { name: 'Confirmar asistencia' }).click();
  await expect(page.getByRole('status')).toContainText('Ya confirmaste');
  expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).customerConfirmedAt).not.toBeNull();
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click(); await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click();
  await expect(page).toHaveURL(/\/manage\/cancelled$/);
  expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('CANCELLED');
  await page.goto(link); await expect(page.getByText('Este enlace ya no está disponible.')).toBeVisible();
  const response = await page.request.get(`/api/book/${tenant.shop.slug}/slots?service=${tenant.service.id}&barber=${tenant.barber.id}&date=${tenant.tomorrow}`);
  expect((await response.json()).slots).toContain('10:00');
});

test('aislamiento de rutas directas y API pública', async ({ page, tenant }) => {
  const other = await createTenant();
  try {
    await other.appointment(); await login(page, tenant);
    await page.goto(`/customers/${other.customer.id}`); await expect(page.getByText('Página no encontrada')).toBeVisible();
    await page.goto(`/barbers/${other.barber.id}`); await expect(page.getByText('Página no encontrada')).toBeVisible();
    const response = await page.request.get(`/api/book/${tenant.shop.slug}/slots?service=${other.service.id}&barber=${other.barber.id}&date=${tenant.tomorrow}`);
    expect(response.status()).toBe(400);
    await page.goto('/book/slug-inexistente-e2e'); await expect(page.getByRole('heading')).toContainText(/no encontrada|no disponible/i);
  } finally { await cleanup(other); }
});

for (const width of [375, 390, 430]) test(`mobile ${width}, teclado y health`, async ({ page, tenant }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/book/${tenant.shop.slug}`);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: /Corte E2E/ })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('heading', { name: '¿Con quién quieres atenderte?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await login(page, tenant);
  for (const path of ['/cash', `/customers/${tenant.customer.id}`, `/agenda?date=${tenant.tomorrow}`]) {
    await page.goto(path); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Calendario y filtros de agenda' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  const health = await page.request.get('/api/health'); expect(await health.json()).toEqual({ status: 'ok' });
  expect(health.headers()['x-content-type-options']).toBe('nosniff');
});
