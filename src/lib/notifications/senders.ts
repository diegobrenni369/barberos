import twilio from "twilio";
import { readNotificationConfig, SEND_TIMEOUT_MS, type NotificationConfig, type TwilioConfig } from "./config";
import { NotificationError, type NotificationSender, type ReminderSendInput } from "./types";

export function templateVariables(input: ReminderSendInput) {
  const d = input.data;
  return { "1": d.barbershopName, "2": d.customerName, "3": d.serviceName, "4": d.barberName, "5": d.localDate, "6": d.localStartTime, "7": d.manageUrl };
}
export function renderMockReminder(input: ReminderSendInput) {
  const d = input.data;
  return `${d.barbershopName} te recuerda tu reserva ${input.type === "FINAL_REMINDER" ? "próxima" : "programada"}, ${d.localDate} a las ${d.localStartTime} con ${d.barberName}.\n${d.serviceName}. Hola, ${d.customerName}.\nConfirma o cancela aquí: ${d.manageUrl}`;
}
export class MockNotificationSender implements NotificationSender {
  readonly provider = "mock" as const;
  readonly safeToRetryAfterUnknownOutcome = true;
  async sendReminder(input: ReminderSendInput) {
    // Explicit mock IDs, no fabricated Twilio SID. Content may be inspected in tests,
    // but is intentionally not logged or persisted with its bearer token.
    renderMockReminder(input);
    return { externalMessageId: `mock:${input.idempotencyKey}` };
  }
}
export const mockNotificationSender = new MockNotificationSender();
export type TwilioPayload = { from: string; to: string; contentSid: string; contentVariables: string; statusCallback: string };
export type TwilioTransport = (payload: TwilioPayload) => Promise<{ sid: string }>;
export class TwilioWhatsAppSender implements NotificationSender {
  readonly provider = "twilio" as const;
  readonly safeToRetryAfterUnknownOutcome = false;
  private readonly transport: TwilioTransport;
  constructor(private readonly config: TwilioConfig, transport?: TwilioTransport) {
    // No SDK retry: all attempts are accounted for by the durable processor.
    this.transport = transport ?? ((payload) => twilio(config.accountSid, config.authToken, { timeout: SEND_TIMEOUT_MS, autoRetry: false, logLevel: "error" }).messages.create(payload));
  }
  async sendReminder(input: ReminderSendInput) {
    if (!/^\+[1-9]\d{7,14}$/.test(input.phone)) throw new NotificationError("INVALID_PHONE");
    if (!input.type) throw new NotificationError("INVALID_TEMPLATE");
    const callback = new URL(this.config.callbackUrl);
    callback.searchParams.set("reminder", input.idempotencyKey);
    if (input.attemptKey) callback.searchParams.set("attempt", input.attemptKey);
    try {
      const response = await this.transport({ from: this.config.from, to: `whatsapp:${input.phone}`, contentSid: this.config.templates[input.type], contentVariables: JSON.stringify(templateVariables(input)), statusCallback: callback.href });
      if (!/^SM[0-9a-fA-F]{32}$/.test(response.sid)) throw new NotificationError("NETWORK_UNKNOWN", false, true);
      return { externalMessageId: response.sid };
    } catch (error) {
      if (error instanceof NotificationError) throw error;
      const { status, code } = (error && typeof error === "object" ? error : {}) as { status?: number; code?: number };
      if (status === 429) throw new NotificationError("RATE_LIMIT", true);
      if (status === 401 || status === 403 || code === 20003) throw new NotificationError("INVALID_CREDENTIALS");
      if (code === 21211 || code === 21614) throw new NotificationError("INVALID_PHONE");
      if (code === 63016 || code === 63027 || code === 21656) throw new NotificationError("INVALID_TEMPLATE");
      // Twilio Messages POST has no documented caller idempotency guarantee.
      // A 5xx/timeout may have accepted the request: never blindly send it again.
      if (status && status >= 500) throw new NotificationError("PROVIDER_5XX", true, true);
      if (status && status >= 400) throw new NotificationError("PROVIDER_REJECTED");
      throw new NotificationError("NETWORK_UNKNOWN", true, true);
    }
  }
}
export function resolveNotificationSender(config: NotificationConfig = readNotificationConfig()): NotificationSender {
  return config.provider === "mock" ? mockNotificationSender : new TwilioWhatsAppSender(config.twilio!);
}
