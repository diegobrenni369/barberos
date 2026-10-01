# Checklist de producción — piloto BarberOS

No equivale a un despliegue aprobado. Completar en staging antes de aceptar datos
reales. No se ha contratado hosting, activado cron ni habilitado WhatsApp real.

## Configuración y despliegue

- [ ] Definir hosting Node.js, PostgreSQL y dominio HTTPS.
- [ ] `APP_URL=https://dominio` sin path/query/credenciales. `NEXTAUTH_URL`, si se
  define, debe coincidir. El arranque configura NextAuth desde APP_URL.
- [ ] `DATABASE_URL` PostgreSQL con TLS según proveedor; usuario con privilegios
  mínimos y base separada por entorno. Nunca reutilizar producción en tests.
- [ ] `AUTH_SECRET` y `CRON_SECRET`: al menos 32 caracteres aleatorios diferentes,
  almacenados en el gestor de secretos, nunca NEXT_PUBLIC ni en Git.
- [ ] `NOTIFICATION_PROVIDER` explícito. Mock significa que NO se entregan mensajes;
  procesa y marca SENT sintético. No presentar mock como recordatorio real.
- [ ] Para Twilio, completar configuración y aprobación descritas en
  [reminder-provider.md](reminder-provider.md). Sin fallback silencioso.
- [ ] Configurar `RATE_LIMIT_IP_HEADER` como una cabecera de UNA IP que el proxy
  de confianza ELIMINA y SOBRESCRIBE. No aceptar acceso directo al servidor ni
  cadenas x-forwarded-for de clientes. Probar spoofing en el hosting elegido.
- [ ] Compilar e iniciar con variables coherentes. `instrumentation.register`
  rechaza configuración crítica ausente/HTTP inseguro en producción.
- [ ] Ejecutar `npm ci`, `npm run prisma:generate`, `npx prisma migrate deploy`,
  `npx prisma migrate status`, `npm run build`; después `npm run start`.
- [ ] Nunca `prisma db push` ni `migrate dev` en producción. No ejecutar seed demo.
- [ ] Resolver/aceptar formalmente el riesgo residual de dependencias documentado
  en [hardening-review.md](hardening-review.md).

Prisma conserva singleton en hot reload. En serverless utilizar pooling oficial
del proveedor y presupuestar conexiones por instancia × concurrencia. Configurar
timeouts/límite de conexiones en DATABASE_URL según proveedor. Las migraciones
pueden requerir conexión directa distinta; decidirlo al seleccionar hosting.

## Seguridad y operación

- [ ] Verificar headers nosniff, DENY/frame-ancestors, referrer policy y HSTS con
  APP_URL HTTPS al compilar. La CSP es mínima: no es una política completa contra
  XSS, y no introduce unsafe-eval/script overrides ni rompe shadcn.
- [ ] Reverse proxy conserva Host/Origin legítimos para Server Actions y URL/query
  exactos para firma Twilio. No ampliar allowedOrigins con comodines.
- [ ] NextAuth mantiene CSRF propio; Server Actions valida origen. Un token de
  gestión es una credencial bearer: no colocarlo en analítica, referers o logs.
- [ ] Redactar URLs `/book/*/manage/*`, cookies, Authorization y cuerpos en proxy,
  APM y hosting. El logger de aplicación usa allowlist; no puede controlar logs
  automáticos del framework/infraestructura. No publicar el servidor dev.
- [ ] Limitar tamaño/rate de tráfico en ingress además de la aplicación, para
  no convertir PostgreSQL en objetivo de agotamiento de conexiones.
- [ ] `/api/health` debe devolver únicamente ok/degraded y no-cache. Monitorizar
  503/latencia; el check DB usa timeout corto. Restringir frecuencia en ingress.
- [ ] Configurar retención de logs, responsable y alertas. Sentry/APM opcional con
  scrubbing antes de habilitar captura de request; no está integrado.

Rate limiting compartido: tabla técnica PublicRateLimit, claves HMAC de scope/IP,
ventana fija de 60 s. Límites: slots 120, booking 10, login 10, registro 5,
manage 60. Confirmar/cancelar conserva además 10/min por token. Fallas de storage
rechazan la operación, no permiten bypass. El adapter RateLimitStore permite un
Redis futuro sin contratarlo ahora. El webhook firmado y cron autenticado no usan
estos límites. Limpiar expirados de más de un día; cada run de cron borra hasta
1000. Si cron está desactivado, programar esa limpieza por separado y monitorizar
crecimiento. La tabla no almacena IP/email/teléfono en claro.

## Recordatorios y cron

- [ ] Scheduler EXTERNO cada 5 minutos; no setInterval ni cron activado por código.
- [ ] GET/POST `/api/internal/reminders/process` con Bearer CRON_SECRET, o comando
  `npm run reminders:process` en worker autorizado.
- [ ] Verificar evento `reminder_run` con finishedAt y contadores. Alertar si falta
  más de 2–3 intervalos, si hay 503 o aumento de FAILED/OUTCOME_UNKNOWN.
- [ ] Dimensionar lote/timeout; no ejecutar un lote largo en una función corta.
- [ ] Comprobar webhook firmado y recuperación sin duplicados. Un fallo de entrega
  no cancela la cita. Reconciliar resultados inciertos antes de reenviar.

## Backup y restore

- [ ] Activar backups gestionados diarios cifrados: mínimo 14 días de retención.
  Para piloto objetivo RPO ≤24 h; preferir PITR si el proveedor lo ofrece.
- [ ] Definir RTO inicial ≤4 h, responsable y contacto de escalación. Son objetivos,
  no garantías hasta ejecutar una restauración medida.
- [ ] Antes de cambios de versión/migraciones crear snapshot identificado.
- [ ] Ensayar restore en una base NUEVA aislada mediante el proveedor o un dump
  custom PostgreSQL y `pg_restore --no-owner` al destino aislado. Nunca restaurar
  encima de producción durante un ensayo. Verificar destino antes de ejecutar.
- [ ] Comparar conteos de tenants, citas, ventas/pagos y migraciones; ejecutar
  smoke con notificaciones en mock y cron apagado. Documentar tiempo y resultado.
- [ ] Controlar acceso/retención de copias (contienen PII). No adjuntar dumps al repo.

## Rollback

Conservar artefacto y lockfile previos; desactivar scheduler y entrada pública si
hay incidentes, volver al artefacto anterior con esquema compatible. La migración
de rate limit es aditiva: no borrar tablas ni revertir migraciones destructivamente.
Si una migración no es compatible, aplicar corrección hacia adelante o restaurar
snapshot/PITR con aprobación y plan para transacciones posteriores al backup.

## Gate de salida

- [ ] `npm test`, `npm run test:e2e`, lint, tsc, build y diff check correctos.
- [ ] Chromium/WebKit y 375/390/430 px probados en staging.
- [ ] Probar login/logout, reserva simultánea, cobro, comisión y enlace revocado.
- [ ] Owner piloto aprobado; no prometer aislamiento de permisos de staff sin
  definir su política. El piloto actual usa OWNER; no hay RBAC completo.
- [ ] Pagos online continúan sin publicación/activación de cobro real.
