# Fase 10.1 — Recordatorios y respuesta del cliente

## Dominio y migración

Migración aditiva `20260930120000_appointment_reminders`: `AppointmentReminder`,
`AppointmentPublicAccess`, `Appointment.customerConfirmedAt` y `reminderRevision`.
Sin backfill de citas históricas, cambios de disponibilidad ni modelos financieros.
Las FK compuestas `(appointmentId, barbershopId)` impiden vínculos entre tenants.

Tipos: `FIRST_REMINDER` y `FINAL_REMINDER`. Offsets centralizados en
`REMINDER_OFFSETS`: 24 horas y 2 horas exactas antes de `startsAt`.
Canales preparados: WHATSAPP, EMAIL, SMS; solo WHATSAPP se programa.
Estados usados: SCHEDULED, PROCESSING, SENT, CANCELLED, FAILED.

`startsAt` ya es UTC resuelto mediante el timezone de la barbería. Restar duración
en milisegundos no consulta el timezone del servidor ni navegador. Son 24 horas
transcurridas, no necesariamente la misma hora civil del día anterior durante DST.
Los datos del mensaje usan `utcToZonedParts(..., barbershop.timezone)`.
En el ejemplo 30 sep 15:30, creada 29 sep 10:00: AMBOS reminders aplican;
el primero vence 29 sep 15:30 y el final 30 sep 13:30.

## Scheduling y lifecycle

`syncAppointmentReminders` se ejecuta dentro de la transacción que crea o modifica
la cita: creación interna/pública, edición, cambio de estado, drag/drop, restore,
cancelación pública y finalización en checkout. Checkout solo recibe este hook;
no se modifican venta, pago, comisión ni cálculos.

- Solo estados SCHEDULED/CONFIRMED, cita futura y `scheduledFor > now`.
- Teléfono normalizado con `normalizeBookingPhone`, la misma función del booking.
  Sin teléfono válido no se crean reminders WhatsApp; la cita se crea normalmente.
  Se vuelve a comprobar el teléfono y pertenencia al tenant al procesar.
  El formato E.164 no garantiza que el número exista o tenga WhatsApp.
- Reprogramación/cambio de profesional, cliente, servicio o duración: cancela
  SCHEDULED/PROCESSING, revoca enlaces, limpia confirmación y aumenta revisión.
- CANCELLED/COMPLETED/NO_SHOW: cancela pendientes y revoca enlaces. SENT se conserva.
- Restore: nueva revisión y nuevos reminders futuros; jamás reactiva filas antiguas.
- Un cambio SCHEDULED ↔ CONFIRMED o notas no invalida la respuesta del cliente.
- Unique `(appointmentId, revision, type, channel)` + createMany/skipDuplicates
  deduplica scheduling. Restaurar la misma hora genera filas nuevas legítimas.

No hay backfill automático de citas previas ni observer para escrituras SQL
externas. Todo nuevo flujo de mutación de Appointment debe invocar el hook en su
transacción. El processor comprueba estado/revisión antes de enviar como defensa.

## Processor y emisor

`processDueReminders(db, { baseUrl, sender?, now?, barbershopId?, limit? })`
es una función interna, no un endpoint público ni un cron instalado.
`baseUrl` debe provenir de configuración confiable, nunca del Host del request.
Se exige HTTPS salvo localhost para desarrollo. Hasta 100 filas por lote.
Índice `(status, scheduledFor)` para vencidos; índice de tenant/cita/status para
invalidación. Orden estable por fecha/id.

1. Busca SCHEDULED vencidos.
2. Reclama con updateMany condicional SCHEDULED → PROCESSING. Solo un worker gana.
3. Bloquea la fila Appointment en PostgreSQL, vuelve a validar estado, revisión,
   tenant, teléfono, hora y canal; serializa contra cambios de la cita.
4. Emite link, llama NotificationSender y registra SENT/externalMessageId.
5. Fallos se marcan FAILED sin reintento automático ni log de payload/error sensible.

El emisor por defecto devuelve `mock:<reminderId>`, sin red ni logs con teléfono,
nombre o token. Está bloqueado en producción. `NotificationSender` recibe una
clave de idempotencia estable (reminderId), teléfono y `ReminderMessageData`:
barbershopName, customerName, serviceName, barberName, localDate, localStartTime,
manageUrl. El dominio no contiene texto ni SDK específico de Twilio/Meta.

La transacción de envío es breve y apropiada para MOCK. Dos procesadores concurrentes
no llaman dos veces al sender para una misma fila. Esto NO promete exactamente-un
envío externo ante fallos de red/crash: en 10.2 hace falta proveedor idempotente u
outbox durable con payload/link estable y reconciliación. No reutilizar directamente
esta transacción con llamadas lentas de red. PROCESSING tras un crash y FAILED son
estados para revisión, sin recuperación ciega. Un envío ocurrido antes de un fallo
de commit podría haber entregado un enlace cuyo hash no se persistió: resolver con
outbox antes de conectar cualquier proveedor real.

## Acceso público

`issueAppointmentAccess(tx, tenantId, appointmentId)` es una primitiva interna:
el llamador debe autorizar el tenant. Devuelve el path secreto una sola vez.
No hay endpoint anónimo que emita enlaces mediante un CUID. El processor lo usa.
Una futura interfaz administrativa puede usarla después de `requireRole`.

Tokens aleatorios de 32 bytes (256 bits), base64url, hash SHA-256 unique en DB.
URL `/book/[slug]/manage/[token]`, sin ID de cliente/cita, teléfono ni correo.
Vencen al inicio de la cita; revocación adicional por mutaciones terminales o
significativas. Se emite un link nuevo al preparar cada mensaje, por lo que un
reminder final no revoca innecesariamente el link del primero. Los dos se invalidan
al reprogramar. No se almacena token plano.

GET es solo lectura (los previews de mensajería no confirman/cancelan).
Página dinámica/no-store, noindex/nofollow y no-referrer. No recursos de analytics.
Datos mínimos visibles: barbería, fecha/hora local, servicio y profesional.
El link es una credencial bearer: quien lo posee puede gestionar esa cita.

Server Action valida token/hash, slug, tenant, revisión, expiración, revocación,
barbería activa, estado activo y cita futura. Vuelve a comprobar después de bloquear
la cita, evitando carreras con reprogramación/cancelación. Nunca confía en IDs del cliente.
Confirmar solo asigna customerConfirmedAt si era null; repetir preserva timestamp y
AppointmentStatus. Se muestra discretamente en Agenda Quick View.
Cancelar requiere dos pasos en UI y cambia status a CANCELLED; libera slot usando
la lógica ya existente. No hay customerCancelledAt duplicado ni reprogramación pública.
Tras cancelar, se redirige a un comprobante genérico sin datos de la cita; abrir el link revocado muestra el mismo
mensaje genérico que cualquier enlace inválido/expirado/pasado/no gestionable.

## Preproducción / 10.2

- Un número/canal CENTRAL de BarberOS; sin sender phone ni credenciales por tenant.
  El futuro template debe identificar siempre a la barbería (por ejemplo «LUX…»).
- Rate limiting por IP/token/action en infraestructura compartida, protección de abuso.
- Ocultar `/manage/[token]` en logs del proxy/hosting/APM, excluir URLs y formularios
  de analytics, configurar TLS y PUBLIC origin confiable. Next dev puede imprimir
  rutas en logs: no usar tokens reales en entornos/logs de desarrollo compartidos.
- Worker autenticado/scheduler, outbox durable, reconciliación, timeouts/reintentos
  acotados y recuperación segura de PROCESSING. Nunca resetearlos a ciegas.
- Consentimiento y requisitos del proveedor, templates, identificadores y callbacks
  con firma. No incluidos en 10.1.
- No quiet hours, campañas, emails/SMS, analytics ni políticas nuevas de cancelación.

## Validación reproducible

`npx tsx tests/appointment-reminders.integration.ts` usa exclusivamente PostgreSQL
local, reloj fijo y tenants ficticios UUID; limpia sus fixtures en finally.
Cubre offsets/DST, próximos/pasados, teléfono, deduplicación, dos workers, failure,
tokens, tenant FK, confirmación repetida, reprogramación, restore, estados terminales,
cancelación pública y slot libre. Las suites existentes de reserva pública, caja,
Cliente 360, Dashboard, comisiones y servicios verifican regresiones por hooks.

No se envía ningún mensaje real ni se ejecuta el processor sobre datos del usuario
durante estas pruebas. No se instalan tareas programadas.

### Resultado de esta iteración

- Prisma generate: OK. `prisma:migrate` se intentó, pero migrate dev rechazó el
  entorno no interactivo. Se revisó el SQL aditivo de migrate diff y se aplicó con
  migrate deploy. `prisma migrate status`: esquema actualizado.
- 12 grupos de pruebas nuevos: OK. Seis suites de regresión existentes: OK.
- Flujo visual en desktop y móvil de 375px: confirmación, cancelación con doble
  paso, comprobante y rechazo del enlace revocado. Fixtures eliminados.
- Lint, TypeScript y diff check: OK.
- `npm run build` (Turbopack): bloqueado por `binding to a port / Operation not
  permitted` en el procesamiento CSS del entorno, también con ejecución escalada.
  `npm run build -- --webpack`: OK, sin cambiar scripts ni configuración de bundler.
- Sin commit, push, PR ni merge. WhatsApp real y automatización no habilitados.
