import { mobileResponse, resolveMobileSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { logFailure } from "@/lib/safe-logging";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const session = await resolveMobileSession(request);
    if (!session) return mobileResponse({ error: "Sesión no válida." }, 401);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "MobileSession" WHERE "id" = ${session.id} FOR UPDATE`;
      await tx.mobileSession.updateMany({ where: { id: session.id, userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.mobilePushToken.updateMany({ where: { sessionId: session.id, userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return mobileResponse({ ok: true });
  } catch {
    logFailure("auth_failed");
    return mobileResponse({ error: "No se pudo cerrar sesión. Intenta nuevamente." }, 503);
  }
}
