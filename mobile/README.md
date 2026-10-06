# BarberOS mobile — M0 + M1 + M2

Aplicación independiente con Expo Router y TypeScript. M0 implementa autenticación y M1 muestra la agenda real de un profesional a la vez, en modo de solo lectura.

## Agenda M1

`GET /api/mobile/agenda?date=YYYY-MM-DD&barberId=...` exige bearer válido y OWNER. Resuelve el tenant desde la sesión y rechaza profesionales ajenos o inactivos. Reutiliza los helpers web de timezone y disponibilidad. M2 incluye teléfono, notas y precio de la cita únicamente para el detalle autenticado.

## Detalle y acciones M2

Tocar una reserva abre un sheet nativo sin dependencias nuevas. Se cierra con el botón, toque exterior o deslizando hacia abajo desde el tirador superior. El cierre se bloquea mientras se guarda. Cancelar y No asistió piden confirmación nativa.

`PATCH /api/mobile/appointments/[id]/status` admite CONFIRMED desde SCHEDULED y CANCELLED/NO_SHOW desde SCHEDULED o CONFIRMED. No agrega restricción temporal a No asistió: mantiene la regla web actual. Rechaza citas con venta, relaciones inactivas y transiciones terminales. Reutiliza validación de horario y sincronización de recordatorios dentro de una transacción; no ofrece completar, cobrar ni reprogramar.

La respuesta actualiza la tarjeta y el badge sin cambiar fecha ni profesional; canceladas se ocultan. La prueba puntual `npx tsx scripts/check-mobile-status.ts` requiere el servidor local en puerto 3000, comprueba HTTP y elimina sus fixtures. La interacción táctil en dispositivo sigue pendiente.

La app permite anterior/Hoy/siguiente y selección mediante modal, conserva el profesional en estado local al cambiar fecha, muestra reservas (excepto canceladas), descansos y bloqueos. La timeline es un resumen cronológico por hora, no una grilla proporcional ni interactiva. Incluye carga, error/reintento y estados vacíos; descarta respuestas obsoletas al navegar rápidamente. No añade dependencias.

## Desarrollo

1. Aplicar las migraciones y generar Prisma desde la raíz del proyecto.
2. En `mobile`, ejecutar `npm ci`.
3. Crear `.env` siguiendo `.env.example`. Configurar `EXPO_PUBLIC_API_URL` con la URL del backend. En un teléfono físico usar la dirección LAN del computador, no `localhost`; ambos deben tener conectividad entre sí. En producción se exige HTTPS.
4. Iniciar el backend y ejecutar `npm start` dentro de `mobile`. Abrir con un entorno compatible con Expo SDK 57.

La URL pública del backend no es un secreto. No agregar secretos del servidor al entorno Expo.

## Sesiones y alcance

- Se reutiliza la validación de credenciales de la web.
- Acceso limitado a OWNER y barbería activa; se utiliza la primera membresía por fecha de creación, como en la web. No existe selector de barbería en M0.
- El token opaco se guarda en SecureStore. El servidor conserva únicamente su hash SHA-256.
- Expira en siete días y requiere iniciar sesión nuevamente. Cerrar sesión revoca el token antes de eliminarlo del dispositivo. Si la red falla, se permite reintentar.
- Al restaurar la aplicación se verifica la sesión y la membresía en el servidor.
- No se usan cookies de NextAuth ni se incluyen credenciales de base de datos en la aplicación.

## Validación acotada

Desde la raíz: `npm run lint`, `npx tsc --noEmit` y `git diff --check`.
Desde `mobile`: `npm run typecheck`.

`npx tsx scripts/check-mobile-auth.ts` comprueba credenciales, hash, bearer, expiración, revocación, OWNER, aislamiento del endpoint Agenda, profesional activo, fecha, horarios y descansos. Solo admite base local y elimina sus registros temporales. Invoca handlers directamente; no comprueba transporte HTTP ni UI nativa.

Pendiente: verificación en dispositivo/simulador, teclado, SecureStore nativo y tamaños 375/390/430. El entorno de trabajo no dispone de simulador iOS.

La instalación informó vulnerabilidades en el árbol de dependencias. Su evaluación está pendiente antes del piloto; no se aplicó `audit fix --force` ni actualizaciones ajenas al alcance.
