import { mobileResponse, resolveMobileAccess, mobileIdentity } from "@/lib/mobile-auth";
import { logFailure } from "@/lib/safe-logging";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    const shop = access.membership.barbershop;
    return mobileResponse({ ...mobileIdentity(access.membership), user: access.user, barbershop: { id: shop.id, name: shop.name, timezone: shop.timezone }, expiresAt: access.session.expiresAt.toISOString() });
  } catch {
    logFailure("auth_failed");
    return mobileResponse({ error: "No se pudo comprobar la sesión." }, 503);
  }
}
