import { validateCredentials } from "@/lib/credentials";
import { createMobileSession, mobileMembership, mobileResponse, mobileIdentity } from "@/lib/mobile-auth";
import { allowPublicRequest } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logFailure } from "@/lib/safe-logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!await allowPublicRequest(prisma, request.headers, "login")) return mobileResponse({ error: "Demasiados intentos. Espera un minuto." }, 429);
    if (!request.headers.get("content-type")?.includes("application/json")) return mobileResponse({ error: "Solicitud inválida." }, 400);
    const reader = request.body?.getReader();
    if (!reader) return mobileResponse({ error: "Solicitud inválida." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return mobileResponse({ error: "Solicitud demasiado grande." }, 413); }
      chunks.push(value);
    }
    let credentials: unknown;
    try { credentials = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return mobileResponse({ error: "Solicitud inválida." }, 400); }
    const user = await validateCredentials(credentials);
    if (!user) return mobileResponse({ error: "Correo o contraseña incorrectos." }, 401);
    const member = await mobileMembership(user.id);
    if (!member) return mobileResponse({ error: "No tienes un acceso móvil activo. Consulta al propietario." }, 403);
    return mobileResponse({ ...await createMobileSession(user.id), ...mobileIdentity(member), user, barbershop: { id: member.barbershop.id, name: member.barbershop.name, timezone: member.barbershop.timezone } });
  } catch {
    logFailure("auth_failed");
    return mobileResponse({ error: "No se pudo iniciar sesión. Intenta nuevamente." }, 503);
  }
}
