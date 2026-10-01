import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { postgresRateLimitStore, rateLimitIdentity } from "../src/lib/rate-limit";
import { validateProductionEnvironment, publicAppUrl } from "../src/lib/runtime-config";
import { logFailure } from "../src/lib/safe-logging";

const db = new PrismaClient();
const key = `hardening-test-${randomUUID()}`;
async function main() {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL || "").hostname));
  try {
    const env = { NODE_ENV: "production", DATABASE_URL: "postgresql://example:test@db.invalid/app", AUTH_SECRET: "a".repeat(40), CRON_SECRET: "c".repeat(40), APP_URL: "https://barberos.example.test", RATE_LIMIT_IP_HEADER: "x-trusted-client-ip" };
    validateProductionEnvironment(env);
    for (const field of ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "APP_URL", "RATE_LIMIT_IP_HEADER"]) assert.throws(() => validateProductionEnvironment({ ...env, [field]: "" }), new RegExp(field));
    assert.throws(() => publicAppUrl({ NODE_ENV: "production", APP_URL: "http://localhost:3000" }));
    assert.throws(() => publicAppUrl({ NODE_ENV: "production", APP_URL: "https://user:secret@example.test" }));
    assert.throws(() => rateLimitIdentity(new Headers({ 'x-forwarded-for': '1.2.3.4' }), env));
    assert.equal(rateLimitIdentity(new Headers({ 'x-trusted-client-ip': '1.2.3.4' }), env), '1.2.3.4');
    assert.throws(() => rateLimitIdentity(new Headers({ 'x-trusted-client-ip': '1.2.3.4, 5.6.7.8' }), env));
    console.log('PASS production environment rejects unsafe/missing settings; trusted IP contract');
    const store = postgresRateLimitStore(db);
    const results = await Promise.all(Array.from({ length: 25 }, () => store.consume(key, 10, 60)));
    assert.equal(results.filter(Boolean).length, 10);
    assert.equal((await db.publicRateLimit.findUniqueOrThrow({ where: { key } })).count, 10);
    await db.publicRateLimit.update({ where: { key }, data: { expiresAt: new Date(0) } });
    assert.equal(await store.consume(key, 10, 60), true);
    assert.equal((await db.publicRateLimit.findUniqueOrThrow({ where: { key } })).count, 1);
    console.log('PASS shared atomic rate limit, concurrent requests, expiry reset');
    const original = console.error; const logs: string[] = [];
    try { console.error = value => logs.push(String(value)); logFailure('checkout_failed'); } finally { console.error = original; }
    assert.deepEqual(Object.keys(JSON.parse(logs[0])).sort(), ['errorId', 'event']);
    console.log('PASS safe logging only event and random error ID');
  } finally { await db.publicRateLimit.deleteMany({ where: { key } }); await db.$disconnect(); }
}
main().catch(() => { console.error('Hardening test failed'); process.exitCode = 1; });
