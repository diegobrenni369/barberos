import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { ApiError, request } from "./api";

type Session = { user: { id: string; name: string; email: string }; barbershop: { id: string; name: string; timezone: string }; expiresAt: string };
type Auth = { session: Session | null; loading: boolean; error: string; restore: () => Promise<void>; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; get: <T>(path: string, options?: { method: "PATCH"; body: unknown }) => Promise<T> };
const Context = createContext<Auth | null>(null);
const KEY = "barberos.mobile.session";
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = useRef<string | null>(null);
  const restore = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const saved = await SecureStore.getItemAsync(KEY);
      if (saved) {
        const current = await request<Session>("/api/mobile/auth/me", { token: saved });
        token.current = saved; setSession(current);
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        try { await SecureStore.deleteItemAsync(KEY); token.current = null; setSession(null); }
        catch { setError("No se pudo limpiar la sesión. Intenta nuevamente."); }
      } else setError(failure instanceof ApiError ? failure.message : "No se pudo leer la sesión segura.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void restore(); }, [restore]);

  async function login(email: string, password: string) {
    const result = await request<Session & { token: string }>("/api/mobile/auth/login", { method: "POST", body: { email, password } });
    try { await SecureStore.setItemAsync(KEY, result.token, options); }
    catch {
      await request("/api/mobile/auth/logout", { method: "POST", token: result.token }).catch(() => {});
      throw new Error("No se pudo guardar la sesión de forma segura. Intenta nuevamente.");
    }
    token.current = result.token;
    setSession({ user: result.user, barbershop: result.barbershop, expiresAt: result.expiresAt });
  }
  async function logout() {
    if (token.current) {
      try { await request("/api/mobile/auth/logout", { method: "POST", token: token.current }); }
      catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure; }
    }
    // Keep the local session if revocation failed, so the user can retry.
    await SecureStore.deleteItemAsync(KEY);
    token.current = null; setSession(null);
  }
  const get = useCallback(async <T,>(path: string, options?: { method: "PATCH"; body: unknown }): Promise<T> => {
    const current = token.current;
    if (!current) throw new ApiError("Sesión no válida.", 401);
    try { return await request<T>(path, { ...options, token: current }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401 && token.current === current) {
        token.current = null; setSession(null);
        await SecureStore.deleteItemAsync(KEY).catch(() => {});
      }
      throw failure;
    }
  }, []);
  return <Context.Provider value={{ session, loading, error, restore, login, logout, get }}>{children}</Context.Provider>;
}
export function useAuth() { const auth = useContext(Context); if (!auth) throw new Error("AuthProvider required"); return auth; }
