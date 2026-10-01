# Fase 11 — revisión de hardening

## Dependencias (2026-09-30)

Auditoría inicial: 1 critical, 4 high, 0 moderate, 0 low. `npm outdated` revisado,
sin ejecutar audit fix --force.

| Paquete / advisory | Antes | Acción / versión segura | Riesgo |
| --- | --- | --- | --- |
| Next / GHSA-vcvr-r3jv-pc5j | 16.3.5 | Next y eslint-config-next 16.3.8; corregido desde 16.3.6 | Patch misma minor; regresión requerida |
| effect / GHSA-38f7-945m-qr2g | 3.16.12 | 3.21.0 (seguro >=3.20.0), vía Prisma 6.19.3 | Prisma y cliente actualizados juntos, sin major |
| deepmerge-ts / GHSA-ggr8-5vv4-36mx | 7.1.5 | Pendiente: seguro >=8.0.0 | Prisma config exige 7.1.5; override major o downgrade a Prisma 6.12 no aprobado |

Auditoría posterior: 0 critical, 3 high (una raíz deepmerge-ts y sus dependientes
@prisma/config/prisma), 0 moderate, 0 low. No equivale a audit limpio.
Prisma y @prisma/client están en 6.19.3; React/DOM19.2.8, NextAuth4.24.15,
Twilio6.1.2, Zod4.6.5 y Base UI1.8.0 no requirieron upgrade por esta auditoría.
No se adoptan React19.3, TypeScript7 ni Prisma7/8 porque implican alcance adicional.

No se encontró uso de next/og/ImageResponse en src. deepmerge-ts se usa en lectura
de configuración Prisma, no con objetos enviados por usuarios en rutas del negocio.
Esto reduce exposición observada, pero no elimina el advisory. Requiere aceptación
explícita/documentada del riesgo o parche upstream compatible antes del piloto.

Fuentes: [Next](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j),
[Effect](https://github.com/advisories/GHSA-38f7-945m-qr2g),
[DeepmergeTS](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).

## Autorización y datos

No hay middleware que sustituya autorización. Helpers requieren sesión, Membership
y barbería activa. Mutaciones privadas requieren OWNER; tenant se obtiene de esa
Membership, nunca del formulario. Lecturas por ID se filtran por tenant. Caja,
comisiones y detalles financieros requieren OWNER. No se implementa RBAC nuevo;
las lecturas compartidas con BARBER actuales requieren política explícita futura.

Suite dedicada multi-tenant prueba servicios/barberos ajenos, perfil, movimiento,
cobro, comisiones, liquidación, emisión de token y scope de worker. E2E añade rutas
directas y formularios con IDs manipulados. No existe endpoint público para listar
reminders o abrir una Appointment por ID; Agenda obtiene solo las del tenant.

Constraints revisadas: BarberService unique barber/service y FK compuestas;
Sale appointmentId unique; CommissionSettlementItem commissionId unique;
Reminder unique appointment/revision/type/channel; tokenHash unique;
provider/externalMessageId unique. Índices de citas por tenant/día y profesional.
No se añadieron constraints de negocio sin analizar datos existentes.

Tokens: 32 bytes aleatorios (256 bits), solo SHA-256 persistido, expiración al inicio,
revocación al cancelar/reprogramar y revisión validada antes de mutar. Tests 10.1
incluyen enlaces expirados, revocados, tenant incorrecto y reprogramación.

Reserva pública valida Zod estricto, tenant, disponibilidad completa, elegibilidad,
estado/publicación del servicio, límites de fecha y transacción serializable.
Inputs maliciosos son texto escapado o rechazados por schema. No se encontraron
dangerouslySetInnerHTML, queryRawUnsafe o executeRawUnsafe en src. Raw SQL usa
tagged templates parametrizados; constantes SQL no provienen de inputs.

## Errores, logs y límites

Se reemplazaron logs de excepciones crudas de cobro/drag; logger de fallas solo
acepta evento y genera ID. Auth logger no emite metadata. Hook onRequestError no
captura URL, headers ni cuerpo. Reminder logs conservan allowlist segura.
No se promete sanitizar automáticamente logs del hosting/framework; ver checklist.

Boundaries raíz, privada y booking muestran mensaje genérico y retry sin stack.
Not-found genérico no distingue falta de permiso/existencia. Loading discreto en
dashboard, cash, customers, commissions y book. En Agenda se conserva el estado
de carga/transición existente: no se agrega un loading de ruta que haga desaparecer
el panel al cambiar fecha (regresión previamente corregida).

La única nueva tabla es PublicRateLimit, soporte técnico compartido. No se cambian
AppointmentStatus ni cálculos de negocio. Ver contrato proxy y limpieza en checklist.
Health check no expone versiones/URL/env. Scheduler emite resumen fechado sin PII.

## Performance y bundle

Agenda consulta un día y usa consultas agrupadas; Dashboard limita resumen a 6 y
consulta ventana de 7 días, sin N+1 por cita. Slots carga disponibilidad en lotes.
Cliente360 pagina historial. Riesgos conservados para revisión de escala: catálogo
completo de clientes en Agenda, listado de clientes sin paginación y comisiones por
período sin límite máximo. No truncar silenciosamente datos financieros como “fix”.
Para un piloto pequeño medir volumen/latencia antes de ampliar operación.

Twilio/Prisma se mantienen fuera de Client Components; revisar bundle compilado
en validación final. CSP mínima, no auditoría WCAG completa ni pentest externo.
Smoke automático prueba teclado, modales, anchos y flujos, no cada pixel.

## Despliegue

[Checklist técnica](production-checklist.md) y [checklist funcional](pilot-checklist.md)
incluyen backup/restore, pooling, HTTPS, variables, migraciones, cron y rollback.
No se ha desplegado ni hecho upgrade Twilio/envíos reales; pagos online no se activan.
