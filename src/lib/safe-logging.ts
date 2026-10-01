// Never accept error objects, request URLs, headers, or arbitrary metadata.
export function logFailure(event: "checkout_failed" | "appointment_move_failed" | "request_failed" | "rate_limit_unavailable" | "health_degraded" | "auth_failed") {
  const errorId = crypto.randomUUID();
  console.error(JSON.stringify({ event, errorId }));
  return errorId;
}
