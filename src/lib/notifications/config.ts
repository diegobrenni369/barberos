export class NotificationConfigurationError extends Error {
  constructor(field: string) { super(`Invalid notification configuration: ${field}`); }
}
export type TwilioConfig = { accountSid: string; authToken: string; from: string; callbackUrl: string; templates: { FIRST_REMINDER: string; FINAL_REMINDER: string } };
export type NotificationConfig = { provider: "mock" | "twilio"; baseUrl: string; cronSecret?: string; maxAttempts: number; staleMs: number; retryMs: number; twilio?: TwilioConfig };
export const SEND_TIMEOUT_MS = 10_000;
export function readCronSecret() { return process.env.CRON_SECRET; }
function numberSetting(env: Record<string, string | undefined>, key: string, fallback: number, min: number, max: number) {
  const n = env[key] ? Number(env[key]) : fallback;
  if (!Number.isInteger(n) || n < min || n > max) throw new NotificationConfigurationError(key);
  return n;
}
export function readNotificationConfig(env: Record<string, string | undefined> = process.env): NotificationConfig {
  const provider = env.NOTIFICATION_PROVIDER || (env.NODE_ENV === "production" ? "" : "mock");
  if (provider !== "mock" && provider !== "twilio") throw new NotificationConfigurationError("NOTIFICATION_PROVIDER");
  const rawUrl = env.REMINDER_PUBLIC_BASE_URL || env.APP_URL || env.NEXT_PUBLIC_APP_URL || (env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  let base: URL;
  try { base = new URL(rawUrl); } catch { throw new NotificationConfigurationError("REMINDER_PUBLIC_BASE_URL"); }
  if (base.username || base.password || base.search || base.hash || base.pathname !== "/" || (base.protocol !== "https:" && !(env.NODE_ENV !== "production" && base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) throw new NotificationConfigurationError("REMINDER_PUBLIC_BASE_URL");
  const config: NotificationConfig = { provider, baseUrl: base.origin, cronSecret: env.CRON_SECRET,
    maxAttempts: numberSetting(env, "MAX_REMINDER_ATTEMPTS", 3, 1, 10),
    staleMs: numberSetting(env, "PROCESSING_STALE_AFTER_MINUTES", 5, 2, 60) * 60_000,
    retryMs: numberSetting(env, "REMINDER_RETRY_SECONDS", 60, 1, 3600) * 1000 };
  if (provider === "mock") return config;
  const required = (key: string, pattern: RegExp) => {
    const value = env[key] ?? "";
    if (!pattern.test(value)) throw new NotificationConfigurationError(key);
    return value;
  };
  const callbackUrl = env.TWILIO_STATUS_CALLBACK_URL || `${base.origin}/api/webhooks/twilio/whatsapp/status`;
  let callback: URL;
  try { callback = new URL(callbackUrl); } catch { throw new NotificationConfigurationError("TWILIO_STATUS_CALLBACK_URL"); }
  if (callback.protocol !== "https:" || callback.username || callback.password || callback.hash || callback.search || callback.pathname !== "/api/webhooks/twilio/whatsapp/status") throw new NotificationConfigurationError("TWILIO_STATUS_CALLBACK_URL");
  if (base.protocol !== "https:") throw new NotificationConfigurationError("REMINDER_PUBLIC_BASE_URL");
  config.twilio = {
    accountSid: required("TWILIO_ACCOUNT_SID", /^AC[0-9a-fA-F]{32}$/),
    authToken: required("TWILIO_AUTH_TOKEN", /^[0-9a-fA-F]{32}$/),
    from: required("TWILIO_WHATSAPP_FROM", /^whatsapp:\+[1-9]\d{7,14}$/),
    callbackUrl: callback.href,
    templates: { FIRST_REMINDER: required("TWILIO_TEMPLATE_FIRST_REMINDER", /^HX[0-9a-fA-F]{32}$/), FINAL_REMINDER: required("TWILIO_TEMPLATE_FINAL_REMINDER", /^HX[0-9a-fA-F]{32}$/) },
  };
  return config;
}
