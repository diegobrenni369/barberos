# Fase 10.2 — proveedores de recordatorios

## Implementación

`src/lib/notifications/` separa tipos, configuración, senders, procesador,
webhook, cron, logging y rate limiting. `appointment-reminders.ts` conserva
el dominio de 10.1 y reexporta la interfaz y el procesador por compatibilidad.
No se modifican reglas de Agenda, disponibilidad o finanzas.

Se usa el SDK oficial `twilio` exclusivamente desde código servidor para
el cliente tipado y `validateRequest`. Los tests inyectan un transporte falso:
no requieren internet, credenciales ni cuenta habilitada. Mock genera contenido
legible con los mismos datos y devuelve un ID explícito `mock:<reminderId>`.

## Configuración

Consultar `.env.example`. En desarrollo el proveedor predeterminado es mock.
En producción `NOTIFICATION_PROVIDER` debe ser explícito. Twilio sin configuración
válida falla antes de reclamar trabajo; nunca cae silenciosamente a mock.

- `NOTIFICATION_PROVIDER`: `mock` o `twilio`.
- `REMINDER_PUBLIC_BASE_URL`: origen público; HTTPS en producción/Twilio.
- `MAX_REMINDER_ATTEMPTS`: 3 por defecto (1–10).
- `PROCESSING_STALE_AFTER_MINUTES`: 5 por defecto (2–60).
- `REMINDER_RETRY_SECONDS`: base del backoff, 60 por defecto.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`:
  credenciales servidor y único remitente central `whatsapp:+E164`.
- `TWILIO_TEMPLATE_FIRST_REMINDER`, `TWILIO_TEMPLATE_FINAL_REMINDER`:
  ContentSid `HX...` de templates aprobados.
- `TWILIO_STATUS_CALLBACK_URL`: opcional; por defecto el origen público más
  `/api/webhooks/twilio/whatsapp/status`.
- `CRON_SECRET`: secreto aleatorio de al menos 32 caracteres.

Nunca usar prefijo NEXT_PUBLIC para secretos. No hay configuración por barbería.

## Templates

Contrato ContentVariables: 1 barbería, 2 cliente, 3 servicio, 4 profesional,
5 fecha local, 6 hora local, 7 URL de gestión. Configurar ambos templates con
este contrato. Preferir fecha explícita a «mañana» para tolerar ejecución tardía.
No se registraron templates reales ni se activaron envíos.

## Durabilidad e idempotencia

Claim atómico y `claimToken` por intento impiden que dos workers autoricen el
mismo envío. Se registran `attemptCount`, `lastAttemptAt`, `processingStartedAt`,
`dispatchStartedAt`, `nextAttemptAt`, `lastError`, `provider` y `deliveryStatus`.
El hash del enlace se confirma en base de datos antes de contactar al proveedor;
el token plano no se persiste ni se registra. La llamada externa está fuera de
la transacción, con timeout de 10 segundos y sin retries automáticos del SDK.

429 admite retry con backoff exponencial y límite. Teléfono, template,
credenciales y otros rechazos permanentes terminan en FAILED. Timeouts,
errores de red y 5xx son ambiguos: Twilio podría haber aceptado el mensaje.
No hay garantía documentada de deduplicación de Messages POST mediante nuestra
clave interna; por tanto NO se reenvían automáticamente esos casos.

PROCESSING abandonado antes del dispatch vuelve a ser elegible; después del
dispatch real pasa a FAILED/OUTCOME_UNKNOWN. También se conservan con cautela
los PROCESSING heredados sin metadatos. El mock sí permite recuperación segura.
Un callback firmado posterior puede resolver el resultado incierto. Sin callback,
reconciliar manualmente con los registros de Twilio antes de cualquier reenvío;
no resetear estados masivamente. Una cancelación no puede retirar un mensaje
que ya estaba en tránsito, pero no se revierte el estado CANCELLED local.

SENT significa aceptado por el proveedor, no entregado. El SID se guarda en
externalMessageId; deliveryStatus contiene QUEUED, SENT, DELIVERED, READ,
FAILED o UNDELIVERED. Una falla de entrega jamás cambia Appointment.

## Webhook y seguridad

POST `/api/webhooks/twilio/whatsapp/status` requiere firma oficial válida,
AccountSid esperado y formulario limitado a 16 KiB. Se validan todos los campos
recibidos, sin desactivar firma en desarrollo. Se correlaciona por SID; la URL
firmada incluye reminder/attempt para callbacks que llegan antes de persistir SID.
Callbacks repetidos y fuera de orden no degradan un estado más avanzado.
SID desconocido devuelve respuesta vacía segura, sin crear registros.

Detrás de proxy, configurar EXACTAMENTE la URL HTTPS pública que Twilio recibe.
La validación usa esa URL más el query original, no Host/X-Forwarded-Host del
request interno. El proxy debe preservar query y formulario sin reescribirlos.
No aplicar un limitador agresivo al webhook.

Confirmar/cancelar tiene límite compartido PostgreSQL de 10 acciones por minuto
por token válido; no usa Map ni crea filas para tokens inválidos. Complementar
con protección IP/edge contra abuso masivo en producción.

Logs estructurados permiten solo evento, IDs internos y contador. No incluyen
teléfono, payload, URL/token público o credenciales. Next no registra argumentos
de Server Functions ni requests manage/webhook. Configurar también redacción
en proxy, hosting y APM: la configuración de Next no controla esos servicios.

## Scheduler (preparado, NO activado)

`npm run reminders:process` llama a `runReminderProcessor()`; ejecutarlo solo
cuando se quiera procesar realmente los recordatorios elegibles (mock también
marca SENT). Alternativa GET/POST `/api/internal/reminders/process` con
`Authorization: Bearer <CRON_SECRET>`; falta/secreto incorrecto devuelve 401.
Respuesta únicamente agregada, errores sin secretos.

Recomendación inicial: scheduler externo cada 5 minutos. Sin setInterval.
El procesador permite lotes limitados; dimensionar límite/timeout de la plataforma
para el peor caso de llamadas secuenciales antes de activar un cron serverless.

## Migración y pruebas

`20260930180000_reminder_provider` agrega solo metadatos de procesamiento/entrega,
índices y contador de acciones públicas. Conserva datos y AppointmentStatus.
`migrate dev` no fue interactivo: se generó/revisó SQL mediante migrate diff y
se aplicó con migrate deploy en la base local.

`tests/reminder-provider.integration.ts`: configuración, mock, templates,
errores, concurrencia, backoff, límite, recuperación, enlace durable, firma,
callbacks tempranos/duplicados/fuera de orden, rate limiting, cron y redacción.
Regresiones: appointment-reminders, public-booking, cash, customer-profile,
operational-dashboard, commissions y barber-service. Fixtures temporales se limpian.

## Pendientes antes de habilitar Twilio

### M9 — checklist de activación del piloto

- Nueva reserva pública: SCHEDULED, customerConfirmedAt null, source ONLINE.
  El enlace válido pasa a CONFIRMED y registra la primera confirmación; repetir
  no cambia timestamps. No hay cancelación automática por falta de confirmación.
- Mantener NOTIFICATION_PROVIDER=mock hasta completar la preparación externa.
  Mock también consume recordatorios y los marca SENT: usar citas de prueba;
  cambiar a Twilio no reenvía los recordatorios consumidos por mock.
- Configurar en Vercel NOTIFICATION_PROVIDER=twilio, REMINDER_PUBLIC_BASE_URL
  (origen HTTPS público), CRON_SECRET (al menos 32 caracteres), TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (whatsapp:+E164),
  TWILIO_TEMPLATE_FIRST_REMINDER y TWILIO_TEMPLATE_FINAL_REMINDER (HX...).
  TWILIO_STATUS_CALLBACK_URL es opcional y debe coincidir exactamente con la URL
  pública /api/webhooks/twilio/whatsapp/status. No usar secretos NEXT_PUBLIC.
  El origen también admite APP_URL y NEXT_PUBLIC_APP_URL como fallbacks existentes;
  preferir REMINDER_PUBLIC_BASE_URL explícito para piloto.
- Ambos ContentSid reciben las mismas variables: 1 barbería, 2 cliente,
  3 servicio, 4 profesional, 5 fecha local YYYY-MM-DD, 6 hora local HH:mm,
  7 URL completa segura de gestión. El final puede ser breve; conservar el contrato
  existente y probar el template aprobado con esos datos. No asumir que 7 es
  un sufijo de botón URL: el adapter envía una URL completa.
- Habilitar remitente WhatsApp y templates aprobados en Twilio; verificar cuenta,
  saldo/upgrade si corresponde y consentimiento de destinatarios de prueba.
  El sandbox no equivale a un remitente de producción. No se verificó el estado
  de la cuenta ni se activaron servicios desde esta implementación.
- Probar primero con destinatario autorizado: envío, enlace de confirmación,
  cancelación y callback firmado con deliveryStatus. Revisar redacción de URLs
  /manage y secretos en logs del hosting/proxy/APM.
- Activar manualmente GET /api/internal/reminders/process cada 5 minutos
  (*/5 * * * *), con Authorization: Bearer <CRON_SECRET>. POST también funciona.
  Vercel Cron usa GET y agrega el header desde CRON_SECRET; no requiere cambiar
  el endpoint. No se agregó vercel.json ni se activó cron automáticamente.
  Hobby no permite esta frecuencia; requiere plan compatible o scheduler externo.
  Revisar duración de función: hasta 50 envíos secuenciales con timeout de 10 s
  por envío pueden superar el presupuesto de ejecución del hosting.
- FIRST_REMINDER se agenda a -24 h y FINAL_REMINDER a -2 h solo si esa hora aún
  es futura al reservar/reprogramar. Reservas con menos de 2 h no generan esos
  recordatorios; no se añadió envío inmediato. FINAL no excluye citas confirmadas.
- Cancelar/reprogramar cancela pendientes y revoca enlaces; SENT conserva historial.
  Los envíos ambiguos no se reintentan ciegamente: reconciliar con Twilio.
  Un mensaje ya en tránsito no puede retirarse al cancelar.
- Validación de esta entrega: lint y TypeScript; pruebas de regresión actualizadas,
  pero no ejecutadas (sin suites ni envíos reales). Antes de piloto comprobar
  booking → SCHEDULED/null → enlace → CONFIRMED/timestamp estable; cancelación;
  no envío para CANCELLED; reprogramación; y prueba real Twilio autorizada.

Referencias de activación:
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://www.twilio.com/docs/whatsapp/api
- https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates

1. Autorizar upgrade por separado y habilitar remitente WhatsApp central.
2. Registrar/aprobar templates con el contrato anterior.
3. Configurar secretos y dominio HTTPS en hosting; verificar URL detrás del proxy.
4. Probar envío y callbacks reales con destinatario autorizado.
5. Definir reconciliación/alertas para FAILED y OUTCOME_UNKNOWN.
6. Activar scheduler externo y revisar capacidad/logging/rate limiting edge.

Auditoría de dependencias detectó alertas preexistentes: Next 16.3.5
(GHSA-vcvr-r3jv-pc5j, next/og ImageResponse) y cadena Prisma/effect.
No se actualizaron versiones ajenas a esta fase; requieren revisión separada
antes de producción. Twilio no apareció en los hallazgos de esa auditoría.

Fuentes oficiales:
- https://www.twilio.com/docs/messaging/api/message-resource
- https://www.twilio.com/docs/usage/security
- https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder
