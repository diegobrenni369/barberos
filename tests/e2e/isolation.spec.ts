import { test, expect, login, createTenant, cleanup, db } from './fixtures';

test('mutaciones con IDs manipulados no cruzan tenants', async ({ page, tenant }) => {
  const other = await createTenant();
  try {
    const own = await tenant.appointment(), foreign = await other.appointment();
    await login(page, tenant);
    await page.goto(`/agenda?date=${tenant.tomorrow}`);
    await page.getByRole('button', { name: /Cliente E2E/ }).first().click(); await page.getByRole('button', { name: 'Editar reserva' }).click();
    await page.getByRole('dialog').locator('input[name="time"]').fill('12:00');
    await page.getByRole('dialog').locator('input[name="id"]').evaluate((input, id) => { (input as HTMLInputElement).value = id; }, foreign.id);
    await page.getByRole('button', { name: 'Guardar reserva' }).click();
    await expect(page).toHaveURL(/error=/);
    expect(await db.appointment.findUniqueOrThrow({ where: { id: foreign.id } })).toEqual(foreign);
    expect(await db.appointment.findUniqueOrThrow({ where: { id: own.id } })).toEqual(own);
    await page.goto('/barbers');
    await page.locator('button[data-slot="dropdown-menu-trigger"]').first().click(); await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    await page.getByRole('dialog').locator('input[name="id"]').evaluate((input, id) => { (input as HTMLInputElement).value = id; }, other.barber.id);
    await page.getByRole('dialog').locator('input[name="name"]').fill('Intento ajeno'); await page.getByRole('button', { name: 'Guardar barbero' }).click();
    await expect(page).toHaveURL(/error=/); expect((await db.barber.findUniqueOrThrow({ where: { id: other.barber.id } })).name).toBe(other.barber.name);
  } finally { await cleanup(other); }
});

test('BusinessHour ignora barbershopId aportado por el cliente', async ({ page, tenant }) => {
  const other = await createTenant();
  try {
    const before = await db.barbershopBusinessHour.findMany({ where: { barbershopId: other.shop.id }, orderBy: { dayOfWeek: 'asc' } });
    await login(page, tenant); await page.goto('/settings');
    await page.getByRole('button', { name: /Editar horario|Configurar horario|Horario de atención/ }).first().click();
    await page.getByRole('dialog').locator('form').evaluate((form, id) => {
      const input = document.createElement('input'); input.type = 'hidden'; input.name = 'barbershopId'; input.value = id; form.appendChild(input);
    }, other.shop.id);
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); await expect(page).toHaveURL(/success=/);
    expect(await db.barbershopBusinessHour.findMany({ where: { barbershopId: other.shop.id }, orderBy: { dayOfWeek: 'asc' } })).toEqual(before);
  } finally { await cleanup(other); }
});
