import type { ReminderType } from "@prisma/client";

export type ReminderMessageData = {
  barbershopName: string; customerName: string; serviceName: string; barberName: string;
  localDate: string; localStartTime: string; manageUrl: string;
};
export type ReminderSendInput = {
  idempotencyKey: string; attemptKey?: string; phone: string; type?: ReminderType; data: ReminderMessageData;
};
export interface NotificationSender {
  readonly provider?: "mock" | "twilio";
  // True only for senders whose stable key is actually deduplicated.
  readonly safeToRetryAfterUnknownOutcome?: boolean;
  sendReminder(input: ReminderSendInput): Promise<{ externalMessageId: string }>;
}
export type SendErrorCode = "RATE_LIMIT" | "PROVIDER_5XX" | "NETWORK_UNKNOWN" | "INVALID_PHONE" | "INVALID_TEMPLATE" | "INVALID_CREDENTIALS" | "PROVIDER_REJECTED" | "UNKNOWN";
export class NotificationError extends Error {
  constructor(public readonly code: SendErrorCode, public readonly retryable = false, public readonly ambiguous = false) { super(code); }
}
export function classifySendError(error: unknown): NotificationError {
  return error instanceof NotificationError ? error : new NotificationError("UNKNOWN", false, true);
}
