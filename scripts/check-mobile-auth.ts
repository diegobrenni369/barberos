// Focused M0 smoke check, not part of the broad integration suite.
// Creates only isolated local fixtures and removes them in finally.
import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { hashMobileToken } from "../src/lib/mobile-auth";
import { POST as login } from "../src/app/api/mobile/auth/login/route";
import { POST as logout } from "../src/app/api/mobile/auth/logout/route";
import { GET as me } from "../src/app/api/mobile/auth/me/route";
import { GET as agenda } from "../src/app/api/mobile/agenda/route";

async function main() {
  const host = new URL(process.env.DATABASE_URL || "").hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new Error("This check only runs against local PostgreSQL.");
  const marker = randomUUID();
  const email = `mobile-${marker}@example.invalid`;
  const password = randomUUID();
  const rateSecret = randomUUID();
  process.env.AUTH_SECRET = rateSecret;
  process.env.RATE_LIMIT_IP_HEADER = "x-mobile-test-ip";
  const rateKey = createHmac("sha256", rateSecret).update("login:127.0.0.240").digest("hex");
  let userId: string | undefined;
  const shops: string[] = [];
  const loginRequest = (pw: string) => new Request("http://localhost/api/mobile/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "x-mobile-test-ip": "127.0.0.240" }, body: JSON.stringify({ email, password: pw }) });
  const bearer = (token: string) => new Request("http://localhost/api/mobile/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  try {
    userId = (await prisma.user.create({ data: { name: "Mobile smoke", email, passwordHash: await bcrypt.hash(password, 10) } })).id;
    for (const suffix of ["a", "b"]) shops.push((await prisma.barbershop.create({ data: { name: "Mobile smoke", slug: `mobile-${marker}-${suffix}` } })).id);
    await prisma.barbershopMembership.create({ data: { userId, barbershopId: shops[0], role: "OWNER" } });
    assert.equal((await login(loginRequest("incorrecta"))).status, 401);
    const response = await login(loginRequest(password));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token));
    assert.ok(response.headers.get("cache-control") === "no-store");
    const stored = await prisma.mobileSession.findFirstOrThrow({ where: { userId } });
    assert.ok(stored.tokenHash === hashMobileToken(body.token) && stored.tokenHash !== body.token);
    assert.equal((await me(bearer("invalid"))).status, 401);
    assert.equal((await me(bearer("a".repeat(64)))).status, 401);
    const access = await me(new Request(`http://localhost/api/mobile/auth/me?barbershopId=${shops[1]}`, { headers: { Authorization: `Bearer ${body.token}` } }));
    assert.equal(access.status, 200);
    assert.ok((await access.json()).barbershop.id === shops[0]);
    const own = await prisma.barber.create({ data: { barbershopId: shops[0], name: "Own" } });
    const other = await prisma.barber.create({ data: { barbershopId: shops[1], name: "Other tenant" } });
    const inactive = await prisma.barber.create({ data: { barbershopId: shops[0], name: "Inactive", isActive: false } });
    const agendaRequest = (query: string, token = body.token) => new Request(`http://localhost/api/mobile/agenda?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await agenda(agendaRequest("", "invalid"))).status, 401);
    assert.equal((await agenda(agendaRequest(`barberId=${other.id}`))).status, 404);
    assert.equal((await agenda(agendaRequest(`barberId=${inactive.id}`))).status, 404);
    assert.equal((await agenda(agendaRequest("date=2026-02-30"))).status, 400);
    await prisma.barbershopBusinessHour.create({ data: { barbershopId: shops[0], dayOfWeek: "MONDAY", opensMinute: 480, closesMinute: 1080 } });
    await prisma.barberBreak.create({ data: { barbershopId: shops[0], barberId: own.id, dayOfWeek: "MONDAY", startMinute: 780, endMinute: 840, label: "Almuerzo" } });
    const agendaResponse = await agenda(agendaRequest(`date=2026-10-05&barberId=${own.id}&barbershopId=${shops[1]}`));
    assert.equal(agendaResponse.status, 200);
    const day = await agendaResponse.json();
    assert.equal(day.barbershop.id, shops[0]);
    assert.deepEqual(day.barbers.map((item: { id: string }) => item.id), [own.id]);
    assert.equal(day.breaks[0].label, "Almuerzo");
    assert.deepEqual(day.availability, [{ startMinute: 480, endMinute: 1080 }]);
    assert.deepEqual(day.appointments, []);
    const nextDay = await (await agenda(agendaRequest(`date=2026-10-06&barberId=${own.id}`))).json();
    assert.equal(nextDay.date, "2026-10-06");
    assert.deepEqual(nextDay.breaks, []);
    assert.equal((await logout(bearer(body.token))).status, 200);
    assert.equal((await me(bearer(body.token))).status, 401);
    const second = await (await login(loginRequest(password))).json();
    await prisma.mobileSession.updateMany({ where: { userId, revokedAt: null }, data: { expiresAt: new Date(0) } });
    assert.equal((await me(bearer(second.token))).status, 401);
    await prisma.barbershopMembership.updateMany({ where: { userId }, data: { role: "BARBER" } });
    assert.equal((await login(loginRequest(password))).status, 403);
    console.log("M0/M1 OK: auth, expiración, revocación, OWNER, aislamiento Agenda, fecha, profesional activo, horario y descanso.");
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (shops.length) await prisma.barbershop.deleteMany({ where: { id: { in: shops } } });
    await prisma.publicRateLimit.deleteMany({ where: { key: rateKey } });
    await prisma.$disconnect();
  }
}
main().catch(() => { console.error("M0 smoke check failed. No credentials or tokens logged."); process.exitCode = 1; });
