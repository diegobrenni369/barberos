# Checklist funcional del piloto

Usar primero barbería demo y datos ficticios. No cambiar datos reales durante QA.
Registrar responsable, fecha, navegador, versión y evidencia de cada comprobación.

- [ ] Owner puede entrar/salir; ruta privada sin sesión vuelve a login.
- [ ] Se muestra la barbería correcta; IDs de otra barbería no permiten acceso.
- [ ] Horario de atención y timezone correctos, incluidos días cerrados.
- [ ] Barberos activos, jornadas, descansos y bloqueos verificados.
- [ ] Servicios/precios/duración/comisión y profesionales elegibles revisados.
- [ ] Servicios online publicados solo si están listos; políticas de pagos online
  no aparentan un cobro disponible que aún no está implementado.
- [ ] Reserva pública: servicio → profesional → día/slot → datos → confirmación.
- [ ] Dos intentos simultáneos por el mismo horario: solo una reserva.
- [ ] Cita visible en Agenda, edición, cambio de hora/barbero y refresh persistente.
- [ ] Drop sobre reserva/descanso/bloqueo/fuera de jornada rechaza y conserva origen.
- [ ] Cancelación libera slot; restauración revalida disponibilidad.
- [ ] Cobro registra venta, ítem, pago y comisión una sola vez y completa atención.
- [ ] Caja muestra importe y método correctos en timezone local.
- [ ] Cliente 360 muestra atenciones, gasto, ticket e historial coherentes.
- [ ] Liquidación reduce pendiente y no permite pagar dos veces la comisión.
- [ ] Recordatorios mock probados. Si se habilita real: destinatario autorizado,
  template aprobado, callback firmado y aceptación explícita del responsable.
- [ ] Enlace público confirma asistencia sin cambiar estado operacional; cancela
  con confirmación; token caducado/revocado/reprogramado ya no permite acceso.
- [ ] Mobile 375/390/430, Chromium y Safari/WebKit: sin overflow de página,
  controles accesibles, foco/escape en modales y panel de Agenda.
- [ ] Ante falla se ve mensaje seguro, sin SQL, stack o secretos.
- [ ] Backups, restore ensayado, monitoreo/cron y rollback de la checklist técnica.

Automatización: `npm test` ejecuta integración local y `npm run test:e2e` ejecuta
Playwright Chromium/WebKit en puerto 3100 y `.next-e2e` independiente. Fixtures
crean usuarios/tenants aleatorios de prueba y eliminan únicamente esos IDs.
Las pruebas rechazan una DATABASE_URL remota. Nunca apuntarlas a producción.
Screenshots de fallos solo en test-results (ignorado); traces desactivados para
no persistir enlaces bearer/cookies. Borrar artefactos locales según retención.

El seed existente es opcional/manual y restringido a PostgreSQL local. Credenciales
demo son públicas y jamás deben usarse en producción. Las fixtures E2E proporcionan
owner, profesional, servicio, cliente y horario sin modificar el seed del usuario.
