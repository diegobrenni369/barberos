# Comisiones y liquidaciones

Acceso exclusivo OWNER en página y Server Action. El tenant proviene de la sesión, nunca del navegador.

## Fechas y métricas

- Ventas netas / comisión / atenciones: Commission de Sale COMPLETED según Sale.createdAt, usando baseAmount, amount y una atención por venta con comisión. No se recalcula la tasa.
- Pendiente: comisiones válidas del período no incluidas en una liquidación PAID.
- Pagado: suma de totalCommission de liquidaciones PAID cuyo paidAt está en el período. Es flujo de pagos, no devengado; no tiene por qué equivaler a comisión menos pendiente. La pantalla lo explica.
- Mes actual/anterior y rango inclusivo de días civiles, convertido a intervalo UTC semiabierto con timezone de la barbería (incluye DST). periodEnd es exclusivo.
- El resumen siempre corresponde al equipo completo; barber filtra el detalle del equipo/historial.

## Persistencia e integridad

CommissionSettlement guarda nombre del barbero, moneda, período, totales Decimal y paidAt. CommissionSettlementItem copia fecha de venta, cliente, descripción histórica de SaleItem, base, tasa e importe. La consulta de historial utiliza esos snapshots, no Service ni Barber actuales.

Transacción Serializable y unique commissionId impiden pagos dobles, incluso con rangos superpuestos o submits simultáneos. Las claves foráneas compuestas impiden asociar items de otro tenant/barbero. Los conflictos se rechazan y requieren actualizar; no hay reintento ciego que pueda liquidar nuevas ventas sin revisión.

PENDING queda reservado en el schema; esta fase crea liquidaciones directamente PAID de forma atómica. No existe creación/edición de borradores. Registrar pago no realiza transferencia ni cambia Caja, Payment o Commission.

VOIDED se excluye de comisiones pagables. Si una venta se anula después del pago, el snapshot pagado permanece intacto: no hay devolución, compensación automática ni eliminación de historia en esta fase.

Todos los cálculos monetarios se realizan con Prisma.Decimal. formatMoney utiliza la conversión existente únicamente para presentación.

## Validación

`tests/commissions.integration.ts` usa tenants temporales exclusivos de PostgreSQL local y los elimina al terminar. Cubre tasas 50%/40%, total 13000, concurrencia, reintento, cambio de tasa/nombre/servicio, nueva comisión 4000, VOIDED, aislamiento y DST.

La migración es aditiva. Si migrate dev rechaza la terminal no interactiva, generar SQL con migrate diff, revisarlo y aplicarlo con migrate deploy. No usar reset ni db push.

### Resultado de esta implementación

- prisma:generate correcto; migrate dev rechazó la terminal no interactiva. Se revisó el SQL generado, se aplicó con migrate deploy y migrate status confirmó base actualizada.
- Comisiones, cash (25), customer-profile, operational-dashboard, barber-service (9 grupos, incluye movimientos/solapamientos/descansos/bloqueos) y public-booking (15): correctos. Fixtures eliminados al terminar.
- lint, tsc --noEmit y git diff --check: correctos.
- build predeterminado Turbopack: bloqueado por entorno (fuentes/red inicialmente; luego permiso de binding de puerto en procesamiento CSS).
- build --webpack: correcto, incluida ruta /commissions, sin modificar configuración.
- UI revisada en 375, 390, 430 y 1280 px, sin scroll horizontal obligatorio. Sheet revisado con ventas existentes, sin marcar pagos reales.
- Servidor de desarrollo reiniciado para cargar el nuevo Prisma Client.
- Sin commit, push, PR ni merge.
