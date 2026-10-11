import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveMobileAccess, mobileResponse } from "@/lib/mobile-auth";
import { mobileBookingBody } from "@/lib/mobile-booking-http";
import { MobileBookingError } from "@/lib/mobile-booking";

const input = z.object({ token: z.string().max(256).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/), platform: z.enum(["android", "ios"]) }).strict();
export async function POST(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const parsed = input.safeParse(await mobileBookingBody(request));
    if (!parsed.success) return mobileResponse({ error: "Dispositivo no válido." }, 400);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "MobileSession" WHERE "id" = ${access.session.id} FOR UPDATE`;
      const session = await tx.mobileSession.findFirst({ where: { id: access.session.id, userId: access.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!session) throw new Error("SESSION_EXPIRED");
      await tx.mobilePushToken.updateMany({ where: { sessionId: session.id, token: { not: parsed.data.token }, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.mobilePushToken.upsert({ where: { token: parsed.data.token }, create: { ...parsed.data, userId: access.userId, sessionId: session.id }, update: { platform: parsed.data.platform, userId: access.userId, sessionId: session.id, revokedAt: null } });
    });
    return mobileResponse({ ok: true });
  } catch (error) {
    if (error instanceof MobileBookingError) return mobileResponse({ error: error.message }, error.status);
    if (error instanceof Error && error.message === "SESSION_EXPIRED") return mobileResponse({ error: "Sesión no válida." }, 401);
    return mobileResponse({ error: "No se pudo registrar el dispositivo." }, 503);
  }
}
