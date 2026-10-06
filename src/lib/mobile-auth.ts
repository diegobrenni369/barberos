import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const MOBILE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const hashMobileToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createMobileSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_MS);
  await prisma.mobileSession.create({ data: { userId, tokenHash: hashMobileToken(token), expiresAt } });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function resolveMobileSession(request: Request) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  return prisma.mobileSession.findFirst({
    where: { tokenHash: hashMobileToken(match[1]), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, expiresAt: true, user: { select: { id: true, name: true, email: true } } },
  });
}

export async function mobileMembership(userId: string) {
  // Keep the same default tenant as web; never choose a tenant from request input.
  const member = await prisma.barbershopMembership.findFirst({
    where: { userId }, orderBy: { createdAt: "asc" },
    select: { role: true, barbershopId: true, barbershop: { select: { id: true, name: true, isActive: true, timezone: true } } },
  });
  if (!member?.barbershop.isActive) return null;
  if (member.role === "OWNER") return { ...member, barberId: null, barberName: null };
  if (member.role !== "BARBER") return null;
  const barbers = await prisma.barber.findMany({ where: { userId, barbershopId: member.barbershopId }, select: { id: true, name: true, isActive: true }, take: 2 });
  // Ambiguous, missing or disabled associations fail closed.
  if (barbers.length !== 1 || !barbers[0].isActive) return null;
  return { ...member, barberId: barbers[0].id, barberName: barbers[0].name };
}

export async function resolveMobileAccess(request: Request) {
  const session = await resolveMobileSession(request);
  if (!session) return null;
  const membership = await mobileMembership(session.userId);
  return membership ? { session, user: session.user, membership, userId: session.userId, barbershopId: membership.barbershopId, role: membership.role, barberId: membership.barberId } : null;
}

export type MobileAccess = NonNullable<Awaited<ReturnType<typeof resolveMobileAccess>>>;
export function mobileBarberScope(access: MobileAccess) {
  return access.role === "BARBER" ? { barberId: access.barberId! } : {};
}
export function mobileBarberInput(access: MobileAccess, raw: unknown): unknown {
  if (access.role !== "BARBER" || typeof raw !== "object" || !raw || Array.isArray(raw)) return raw;
  return { ...raw, barberId: access.barberId };
}
export function mobileIdentity(member: NonNullable<Awaited<ReturnType<typeof mobileMembership>>>) {
  return { role: member.role, barberId: member.barberId, barberName: member.barberName };
}

export function mobileResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
