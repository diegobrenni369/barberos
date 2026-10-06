import { z } from "zod";
import { mobileResponse, resolveMobileAccess, type MobileAccess } from "@/lib/mobile-auth";
import { MobileBookingError } from "@/lib/mobile-booking";

export async function mobileBookingRoute(request: Request, action: (barbershopId: string, access: MobileAccess) => Promise<unknown>) {
  try {
    const access = await resolveMobileAccess(request);
    if (!access) return mobileResponse({ error: "Sesión no válida." }, 401);
    return mobileResponse(await action(access.membership.barbershopId, access));
  } catch (error) {
    if (error instanceof MobileBookingError) return mobileResponse({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return mobileResponse({ error: "Revisa los datos ingresados." }, 400);
    const message = error instanceof Error ? error.message : "";
    if (message === "BARBER_SERVICE_INELIGIBLE") return mobileResponse({ error: "Este profesional no realiza ese servicio." }, 409);
    if (message === "ACTIVE_APPOINTMENT") return mobileResponse({ error: "No se puede bloquear un horario con reservas activas." }, 409);
    if ((error as { code?: string })?.code === "P2034") return mobileResponse({ error: "El horario cambió. Actualiza e intenta nuevamente." }, 409);
    return mobileResponse({ error: "No se pudo guardar. Intenta nuevamente." }, 503);
  }
}

export async function mobileBookingBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new MobileBookingError("Formato no válido.", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new MobileBookingError("Datos no válidos.", 400);
  const decoder = new TextDecoder(); let text = ""; let size = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.length;
    if (size > 4096) { await reader.cancel(); throw new MobileBookingError("Solicitud demasiado grande.", 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()) as unknown; } catch { throw new MobileBookingError("Datos no válidos.", 400); }
}
