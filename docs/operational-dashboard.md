# Dashboard operacional

`/dashboard` es un Server Component. El resumen financiero se consulta/renderiza únicamente para OWNER, igual que Caja; BARBER conserva su bienvenida anterior. Sin membership se conserva onboarding.

## Semántica

- Hoy: fecha local de Barbershop.timezone, límites semiabiertos construidos con dayRangeUtc.
- Reservas: todos los estados por Appointment.startsAt del día, incluidas canceladas. Activas: SCHEDULED + CONFIRMED, incluso si ya pasó su hora; nunca se reclasifican automáticamente.
- Atenciones: COMPLETED por startsAt. Canceladas/No asistió: estado explícito por startsAt; no cuentan acciones de cancelación efectuadas hoy.
- Ventas: Sale COMPLETED por createdAt del día, suma Sale.total con Decimal; comparte validSalesInRange con Caja. No usa Payment ni precios de servicios/citas. Ticket = total / cantidad de ventas válidas; cero sin ventas.
- Agenda de hoy: máximo seis citas del día COMPLETED/SCHEDULED/CONFIRMED, orden startsAt/id. Enlace a fecha local de Agenda.
- Equipo: todos los barberos activos, incluso sin actividad. Atenciones por Appointment.barberId; ventas por Sale.barberId histórico registrado al cobrar (no por el barbero actual de una cita ni por Commission). Próxima activa de hoy. Las ventas de barberos actualmente inactivos siguen incluidas en el total pero no en la lista de equipo activo.
- Tendencia: siete días calendario incluyendo hoy, ventas por createdAt y atenciones por startsAt, días vacíos en cero. Aritmética Decimal; conversión a number solo para altura visual y formatter existente. Sin nueva librería; barras con Tooltip shadcn accesible por foco.

## Consultas y actualización

Cuatro consultas independientes de cantidad de días/barberos: citas mínimas de siete días, ventas mínimas del rango, equipo activo, primeras seis citas relevantes del día con relaciones. Agrupación en memoria; sin N+1 ni consultas por día. Todos los scopes incluyen tenant desde membership, nunca desde cliente. Para volúmenes mucho mayores se podría llevar agrupación local al SQL, no es necesario en esta fase.

Sin caché explícita, polling ni realtime. Crear/editar/restaurar/mover reserva, cobrar, reserva pública y cambios de barberos revalidan Dashboard. Una pestaña abierta no se actualiza sola con cambios desde otra sesión; navegar/refrescar obtiene nuevos datos.

Responsive: KPIs 2 columnas en móvil/4 en desktop; Agenda+Equipo apilados en móvil; gráfico único con siete barras. Sin tablas horizontales.

Sin Prisma/migraciones ni KPIs persistidos. Sin ocupación, comparación, ingresos contables ni nuevas reglas de negocio.

## Verificación

`node --import tsx tests/operational-dashboard.integration.ts`: fixtures dedicadas locales, cleanup en finally. Referencia 19 reservas, 11 activas, 5 atenciones, 2 canceladas, 1 no-show, $70.000 y ticket $14.000; equipo Diego 3/$40.000/14:30 y Juan 2/$30.000/15:00. Comprueba anuladas, límites locales cerca de medianoche UTC, igualdad con Caja, tendencia, tenant vacío y calendario sobre DST.
