type ReminderEvent = "reminder_claimed" | "reminder_sent" | "reminder_failed" | "reminder_recovered" | "twilio_callback";
type SafeFields = { reminderId: string; appointmentId?: string; barbershopId?: string; attemptCount?: number };
// Deliberate allowlist: never spread error, message payload, URL, phone or credentials.
export function reminderEvent(event: ReminderEvent, fields: SafeFields) {
  console.info(JSON.stringify({ event, reminderId: fields.reminderId, appointmentId: fields.appointmentId, barbershopId: fields.barbershopId, attemptCount: fields.attemptCount }));
}
export function redactManageUrl(value: string) {
  return value.replace(/(\/book\/[^/\s]+\/manage\/)[^/?#\s]+(?:[?#][^\s]*)?/g, "$1[REDACTED]");
}
