import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateProductionEnvironment, publicAppUrl } = await import("./lib/runtime-config");
  validateProductionEnvironment();
  if (process.env.NODE_ENV === "production") {
    process.env.NEXTAUTH_URL = publicAppUrl();
    const { readNotificationConfig } = await import("./lib/notifications/config");
    readNotificationConfig();
  }
}

export const onRequestError: Instrumentation.onRequestError = async () => {
  const { logFailure } = await import("./lib/safe-logging");
  logFailure("request_failed");
};
