type Environment = Record<string, string | undefined>;

export function publicAppUrl(env: Environment = process.env) {
  const raw = env.APP_URL || env.NEXT_PUBLIC_APP_URL || (env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid configuration: APP_URL"); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !["http:", "https:"].includes(url.protocol)
    || (env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("Invalid configuration: APP_URL");
  return url.origin;
}

export function validateProductionEnvironment(env: Environment = process.env) {
  if (env.NODE_ENV !== "production") return;
  let database: URL;
  try { database = new URL(env.DATABASE_URL || ""); } catch { throw new Error("Invalid configuration: DATABASE_URL"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("Invalid configuration: DATABASE_URL");
  for (const field of ["AUTH_SECRET", "CRON_SECRET"]) {
    if ((env[field]?.length ?? 0) < 32) throw new Error(`Invalid configuration: ${field}`);
  }
  const origin = publicAppUrl(env);
  if (env.NEXTAUTH_URL && env.NEXTAUTH_URL !== origin) throw new Error("Invalid configuration: NEXTAUTH_URL must match APP_URL");
  // Only a header overwritten by the trusted ingress may identify an IP.
  if (!/^[a-z0-9-]+$/.test(env.RATE_LIMIT_IP_HEADER || "")) throw new Error("Invalid configuration: RATE_LIMIT_IP_HEADER");
}
