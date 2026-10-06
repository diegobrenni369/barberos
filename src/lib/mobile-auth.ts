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
  // Same default membership as web. M0/M1 intentionally supports OWNER only.
  const member = await prisma.barbershopMembership.findFirst({
    where: { userId }, orderBy: { createdAt: "asc" },
    select: { role: true, barbershopId: true, barbershop: { select: { id: true, name: true, isActive: true, timezone: true } } },
  });
  return member?.role === "OWNER" && member.barbershop.isActive ? member : null;
}

export async function resolveMobileAccess(request: Request) {
  const session = await resolveMobileSession(request);
  if (!session) return null;
  const membership = await mobileMembership(session.userId);
  return membership ? { session, user: session.user, membership } : null;
}

export function mobileResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
