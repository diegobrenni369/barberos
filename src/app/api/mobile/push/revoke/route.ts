import { prisma } from "@/lib/prisma";
import { resolveMobileAccess, mobileResponse } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    await prisma.mobilePushToken.updateMany({ where: { sessionId: access.session.id, userId: access.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return mobileResponse({ ok: true });
  } catch { return mobileResponse({ error: "No se pudo actualizar el dispositivo." }, 503); }
}
