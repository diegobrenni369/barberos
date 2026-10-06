const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function request<T>(path: string, options: { token?: string; method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  if (!configuredUrl) throw new ApiError("Configura EXPO_PUBLIC_API_URL para conectar con BarberOS.", 0);
  const url = new URL(configuredUrl);
  if ((url.protocol !== "https:" && !( __DEV__ && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
    throw new ApiError("La URL de BarberOS no es válida. Usa HTTPS en producción.", 0);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${configuredUrl}${path}`, {
      method: options.method || "GET", signal: controller.signal, credentials: "omit", redirect: "error",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    // Never display arbitrary server/proxy text or log credentials/responses.
    if (!response.ok) {
      const message = response.status === 401 ? "Correo, contraseña o sesión no válidos." : response.status === 403 ? "Se requiere un propietario con barbería activa." : response.status === 429 ? "Demasiados intentos. Espera un minuto." : "No se pudo completar la operación. Intenta nuevamente.";
      throw new ApiError(message, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("No se pudo conectar con BarberOS. Revisa tu conexión.", 0);
  } finally { clearTimeout(timeout); }
}
