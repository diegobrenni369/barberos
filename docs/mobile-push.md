# M10 — Push operativas Mobile

## Instalación y despliegue

- Expo SDK 57: expo-notifications y expo-device instalados con `npx expo install`.
  expo-constants ya existía. No hay SDK nuevo en backend: usa fetch a Expo Push API.
- Migración `20261010120000_mobile_push` preparada, NO aplicada por esta tarea.
  Ejecutar el procedimiento habitual de migraciones antes de desplegar este código.
  MobilePushToken tiene token único, userId, sesión del dispositivo, plataforma y
  revocación lógica. MobilePushDelivery solo conserva deduplicación y recibos;
  no es un centro de notificaciones ni contiene nombres/mensajes.
- Vincular la app al proyecto EAS: `extra.eas.projectId` o Constants.easConfig.
  No se incluyó ningún projectId ficticio. Configurar bundle identifier/package
  propios y credenciales APNs/FCM v1 en EAS. Crear e instalar un development build
  después de añadir el plugin expo-notifications. Probar en dispositivo físico.
- Expo Go sigue abriendo la app: se omite cargar el módulo de push remoto allí.
  La fila de Más explica la limitación. Permisos y registro se prueban en build nativo.
- Opcional servidor: EXPO_ACCESS_TOKEN, solo si el proyecto Expo usa seguridad
  mejorada del servicio push. Nunca ponerlo en EXPO_PUBLIC ni logs.

## Flujo y seguridad

- POST /api/mobile/push/register acepta únicamente token y platform; userId y
  sesión provienen del bearer MobileSession. Registro/upsert, rotación y reactivación.
- POST /api/mobile/push/revoke revoca únicamente los tokens de la sesión actual
  cuando el dispositivo retira permisos. Logout hace lo mismo en su transacción,
  sin afectar otras sesiones/dispositivos. Registro y logout bloquean la sesión
  para impedir que un registro concurrente la reactive después del logout.
- Se solicita permiso contextual una vez por usuario/dispositivo; “Ahora no”
  no vuelve a preguntar automáticamente. Más permite activar/reintentar.
  Registro se sincroniza al entrar, volver del background y rotar token nativo.
- Destinatarios: OWNER del tenant y BARBER asignado con User activo y vinculado.
  Se comprueba la identidad/tenant efectivo de Mobile y sesión vigente. Se deduplican
  usuarios; cada dispositivo activo recibe una copia. No se usa selectedBarber.
- Eventos: creación ONLINE; cancelación pública, web y mobile; reprogramación web
  mediante edición o drag & drop. Un cambio sin movimiento/cancelación no avisa.
- Se programa con Next after únicamente tras commit, fuera de transacciones y
  antes de redirects. Rollback o conflicto no programan envío. Cada dispositivo
  y versión de evento tiene clave única. Fallos Expo se capturan sin fallar citas.
- Transporte best-effort: no se reenvían resultados ambiguos; no hay garantía de
  entrega si el proceso termina antes/después de enviar. Tampoco se puede retirar
  un push ya en tránsito. Un evento superado por otra versión se omite.
- Tickets DeviceNotRegistered revocan el token. Recibos diferidos se consultan
  desde el cron protegido existente /api/internal/reminders/process (GET/POST con
  CRON_SECRET), antes del motor WhatsApp; sin un cron activo no habrá revisión
  periódica de recibos. Se revisan hasta 100 por pasada, después de 15 minutos.
  No se instaló cron nuevo ni se activaron envíos desde esta tarea.
- Un error de credenciales no revoca dispositivos. Los logs solo registran un
  código de evento, nunca token, cuerpo, nombre, teléfono ni secretos.
- Tap valida tenant/identidad y fecha, abre Agenda con día y profesional; no abre
  detalle. Las citas canceladas siguen ocultas por las reglas actuales de Agenda.

## Verificación pendiente antes de piloto

Ejecutar en dos dispositivos/cuentas de prueba: permiso y registro repetido;
reserva ONLINE; cancelación pública/interna; edición y movimiento; OWNER/BARBER;
otro tenant; token inválido y recibos; tap en frío/caliente; logout de un dispositivo;
fallo Expo sin rollback de cita. No usar datos reales para estas pruebas.

Esta tarea ejecuta únicamente lint web, TypeScript web y typecheck mobile.
No aplica migraciones, no crea credenciales, no compila builds nativos ni envía
push de prueba. La entrega real depende de EAS/APNs/FCM y permisos del dispositivo.

Fuentes:
- https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/sending-notifications/
