import { spawnSync } from "node:child_process";

const suites = ['hardening', 'multi-tenant', 'appointment-reminders', 'reminder-provider', 'public-booking', 'barber-service', 'cash', 'customer-profile', 'commissions', 'operational-dashboard'];
for (const suite of suites) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', `tests/${suite}.integration.ts`], { stdio: 'inherit', env: { ...process.env, NOTIFICATION_PROVIDER: 'mock' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
