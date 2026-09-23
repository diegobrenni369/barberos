# Reserva pública — Fase 6A

## Rutas y configuración

- Página sin autenticación ni App Shell: `/book/[slug]`. Slug inválido, inexistente o barbería inactiva: 404.
- Lectura de slots: `GET /api/book/[slug]/slots?service=…&barber=…&date=YYYY-MM-DD`; omitir barber significa búsqueda ANY. Respuesta no cacheable: únicamente `{ slots: ["09:00", …] }` o error seguro.
- Confirmación: Server Action `bookAppointment`, validación estricta y tenant resuelto por slug. No recibe barbershopId ni acepta precio, duración, estado o customerId del cliente.
- Service incorpora `isOnlineBookingEnabled` (false por defecto), `onlinePaymentPolicy` (NONE por defecto) y `depositAmount` nullable. El diálogo existente permite configurarlos; el abono aparece solo para DEPOSIT. Dinero se valida como texto decimal y persiste con Prisma.Decimal.
- Políticas NONE/OPTIONAL/FULL/DEPOSIT. En 6A únicamente NONE se publica y se confirma. Las otras políticas pueden guardarse, pero quedan ocultas públicamente incluso con online habilitado. El backoffice lo advierte. No hay flujo de pago ficticio.
- Abono mayor que cero y menor o igual al precio; solamente para DEPOSIT. Al cambiar política desde el formulario se borra el abono anterior. Editar la configuración conserva isActive=false correctamente.
- Migración `20260923021304_public_booking`: agrega esos campos y AppointmentSource INTERNAL/ONLINE; no elimina ni publica automáticamente datos existentes.

## Experiencia

Servicio → Profesional → Calendario/slots → Tus datos → Resumen → Confirmación.
Se conservan los datos al volver; un cambio de servicio, profesional o fecha invalida el horario seleccionado. Seleccionar un horario no escribe en PostgreSQL.

La interfaz usa Card, Button, Calendar, Input, Label, Separator y Skeleton existentes. Columna central max-width, controles táctiles, sin tablas de gestión ni dependencia de hover. No hay login, contraseña, notas ni datos personales en URLs.

## Fuente compartida de disponibilidad

Se reutilizan exactamente los checks de Agenda:

- `ensureBarberAvailable` → `effectiveAvailability` (BusinessHour ∩ configuración efectiva del barbero).
- `ensureNoBarberBreak`.
- `ensureNoBarberBlock`.
- `ensureNoOverlap` (excluye solo CANCELLED, igual que Agenda).
- `dayOfWeekForDate`, `dayRangeUtc`, `zonedDateTimeToUtc`, `utcToZonedParts`.

Los checks ahora aceptan opcionalmente filas precargadas por tenant, barbero y día. Los consumidores de Agenda mantienen las firmas compatibles y su consulta habitual. La reserva pública usa esos mismos checks sin repetir consultas por slot. No se creó un segundo motor con reglas separadas.

`loadBookingDay` carga servicio elegible, horario del negocio y barberos con intervalos/conflictos mínimos del rango. No carga nombres de clientes ni etiquetas privadas. `getPublicSlots` genera candidatos de 30 minutos centralizados en PUBLIC_SLOT_MINUTES, independiente del intervalo visual de Agenda. Toda la duración debe caber, no solamente el comienzo. La prueba verifica menos de 15 consultas para el día completo y concordancia con los checks originales que consultan la base.

Se usa el timezone de la barbería, nunca el del navegador para resolver instantes. Días cerrados deshabilitados, fechas/horas pasadas rechazadas, horizonte público acotado a 90 días. Se rechazan horas locales inexistentes por DST mediante round-trip.

## Profesionales y concurrencia

BarberService define explícitamente qué profesionales realizan cada servicio. La UI, slots y confirmación consideran solo asociados activos del tenant. ANY mantiene el orden determinista por ID y prueba únicamente estos candidatos. Ver `docs/barber-services.md` para migración y comportamiento de reservas existentes.

ANY es null en la búsqueda, nunca un barberId almacenado. Se recorre el conjunto elegible por ID ascendente y se asigna el primer disponible. Los slots públicos son la unión deduplicada de disponibilidad real. No hay asignación aleatoria.

Confirmar ejecuta una transacción SERIALIZABLE con hasta tres intentos ante P2034. Dentro se releen tenant activo, servicio publicado con NONE, duración/precio, horarios, descansos, bloqueos y reservas. Se selecciona nuevamente el profesional. La creación de Customer si corresponde y Appointment es atómica.

Si un barbero se ocupó, ANY prueba los siguientes. Sin candidatos: “Este horario acaba de ser reservado. Elige otro horario.” La UI vuelve al horario, conserva los datos del cliente y vuelve a consultar slots. El submit tiene bloqueo local durante la petición. SERIALIZABLE protege también frente a otros escritores transaccionales de Agenda.

## Cliente, privacidad y finanzas

Teléfono obligatorio; normalización de separadores, prefijo 00 y números chilenos de 9 dígitos a +56. Consulta SQL parametrizada y acotada al tenant compara teléfonos existentes incluso formateados. Se reutiliza el primer Customer activo coincidente por createdAt/id; no se sobrescriben nombre, teléfono o email de un cliente existente sin verificación. Los inactivos no se reactivan. La respuesta nunca informa si el teléfono existía.

La página entrega solo nombre/dirección del negocio, servicios públicos (nombre/precio/duración y referencia de selección), profesionales activos (nombre y referencia), moneda y fechas habilitadas. La API no devuelve citas, clientes, emails/teléfonos de barberos, razones/notas de bloqueo ni etiquetas de descanso. Los errores inesperados se sustituyen por mensajes públicos genéricos; logs internos no incluyen datos de cliente.

Appointment se crea CONFIRMED y source ONLINE, con un barberId real y precio del servicio leído en servidor. No se crea Sale, Payment ni Commission. Agenda usa las reservas del tenant por rango, sin excluir source ONLINE; su diseño y drag & drop no se modificaron.

## Preparación 6B y límites

- Selección/consulta de slots y confirmación definitiva son operaciones separadas. En 6B, FULL/DEPOSIT podrá pasar por SlotHold → gateway → webhook antes de confirmar Appointment. No hay hold ni pago implementado ahora.
- Rate limiting distribuido no existe en la infraestructura actual. Antes de exponer públicamente en producción, configurar protección antiabuso por IP/tenant y límites de confirmaciones/consultas en infraestructura compartida; no usar un Map en memoria como garantía multiinstancia. La confirmación anónima tampoco verifica propiedad del teléfono; no habilita acceso a historial ni modificación de Customer.
- Pendientes 6B: gateway, intentos versus pagos efectivos, idempotencia/webhooks, expiración de hold, reglas de comisión/prepago y saldo. No implementados emails, WhatsApp, cancelación/reprogramación pública, cuentas ni pagos mixtos.
- La confirmación es estado de la página, no un enlace público recuperable; un refresh reinicia el flujo. No se persisten datos personales en browser storage ni se expone un identificador de reserva.

## Validaciones realizadas

- Pruebas PostgreSQL: `npx tsx tests/public-booking.integration.ts`. Fixtures dedicados con identificadores aleatorios, nunca seed, limpieza en finally. Cubre horarios/descansos/bloqueos/duración, checks compartidos, concurrencia específica y ANY, teléfono compartido concurrente, separación multi-tenant, source, políticas y validación de abono.
- `--preview` crea las mismas fixtures para revisión manual; Ctrl+C las elimina. Solo permite PostgreSQL local.
- Regresión de Caja: 25 comprobaciones aprobadas.
- Flujo público completo en navegador: reserva confirmada y fila ONLINE/CONFIRMED verificada. Fixtures visuales eliminadas después.
- Servicio, profesional, calendario, slots, formulario, resumen y confirmación comprobados a 375, 390, 430 y 1280 px: sin scroll horizontal. Consola sin errores/warnings en la prueba.
- Prisma generate/migrate/status, lint, TypeScript y diff-check ejecutados. Build bloqueado por permiso del entorno: Turbopack → globals.css → binding to a port → Operation not permitted. Sin cambios de configuración para ocultarlo.
