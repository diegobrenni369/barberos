# Caja — Fase 5A

- `OWNER` registra cobros y consulta `/cash`; la membership vigente determina el tenant, nunca el navegador.
- Sale está separada de Appointment. `appointmentId` es opcional y único. La UI solo cobra reservas; no hay ventas libres.
- SaleStatus incluye COMPLETED/VOIDED para preparar una futura anulación. No existe UI ni acción de anulación o borrado de ventas.
- SaleItem, Payment y Commission tienen tenant y FK compuesta a Sale, evitando hijos asociados a otra barbería.
- Cada cobro crea un ítem, un pago y una comisión; Payment no tiene unicidad por venta, para permitir pagos múltiples en otra fase.
- Se cobra `Appointment.price`, no el precio de catálogo que pudo cambiar después de agendar. Se toman snapshots del nombre actual del servicio, cliente y barbero, moneda, precio, descuento y comisión.
- El porcentaje de comisión es 0–100. Base = total después del descuento. Cálculo con Prisma.Decimal; CLP se redondea al peso más cercano, mitad hacia arriba. No se habilitan múltiples monedas: la configuración actual admite CLP.
- El descuento es un monto entero en CLP entre cero y subtotal. Se admite total cero con un registro de pago por cero; no hay integración bancaria.
- El cliente usa BigInt para la vista previa en pesos enteros. Solo `formatMoney` convierte a Number para presentación con Intl; el servidor recalcula todo desde PostgreSQL.
- Transacción SERIALIZABLE, hasta tres intentos ante P2034, unicidad de `appointmentId`, verificación de versión de Appointment y bloqueo del submit en UI protegen contra doble cobro y datos obsoletos.
- CANCELLED/NO_SHOW se rechazan. COMPLETED sin Sale puede cobrarse y muestra una advertencia explícita. Cualquier Sale existente, incluso VOIDED, impide otro cobro en esta fase.
- Una reserva cobrada no puede editarse mediante la acción existente. Su atención y su historial financiero quedan consistentes; no se modifica el drag ni el TimeGrid.
- Caja agrupa por fecha de registro de la venta en el timezone de la barbería, no por fecha de la cita. Usa el rango UTC diario existente, incluyendo días de 23/25 horas. Listado descendente, snapshots históricos y comisión en detalle.

## Verificación

## Cierre de dominio financiero

- `AppointmentStatus` describe atención, no dinero. `Sale.status = COMPLETED` tampoco significa pagada: describe la venta registrada. Una venta con reserva CONFIRMED está permitida, sin comisión obligatoria.
- `sale-balance.ts` centraliza SUM(Payment.amount), max(total - paidAmount, 0) y paidAmount >= total usando Decimal. Total cero se considera saldado; VOIDED se presenta como anulada independientemente del saldo matemático.
- No se agregaron modelos, enums, restricciones ni migraciones en esta revisión. Sale → Payment ya es 1:N.
- El checkout presencial completa la atención y toma la comisión en la misma transacción. Esto es una política de ese flujo, no una consecuencia general de registrar dinero.
- La edición/creación operacional no permite pasar manualmente a COMPLETED; debe usarse Cobrar. Se conservan registros históricos COMPLETED sin venta y la posibilidad de cobrarlos. No hay constraint de base de datos que prohíba esos registros.
- Quick View obtiene el estado financiero de los pagos, no de Appointment.status, y reutiliza SaleDetails mediante una lectura autorizada OWNER y filtrada por tenant.
- Caja usa “Ventas del día” y hora 24h también en el detalle. Su resumen actual agrupa ventas por fecha de venta; para Fase 6 habrá que definir por separado ingresos por fecha de pago cuando los abonos ocurran en días distintos.
- Fase 6 debe definir proveedor/idempotencia de gateway, pagos confirmados frente a intentos, política de comisiones antes/después de atender y devoluciones. Payment actualmente representa dinero registrado. No guardar intentos pendientes como pagos efectivos.
- Las acciones actuales bloquean edición de reservas con venta para proteger sus snapshots. La futura atención de una reserva prepagada necesitará su transición operacional autorizada, separada de checkout; el modelo ya permite esa transición, pero no se agrega UI anticipada.

### Pruebas

`npx tsx tests/cash.integration.ts` ejecuta pruebas reales con dos barberías de prueba de identificadores aleatorios. No usa seed ni clientes normales. Limpia exclusivamente sus fixtures en `finally` (incluidas ventas artificiales de prueba). No ejecutar contra producción.

Prueba manual pendiente antes de aprobar: abrir una reserva, Cobrar, descuento y método, registrar el pago, comprobar estado pagado y Caja, abrir detalle y refrescar. Las pruebas de integración comprueban el núcleo transaccional, pero no reemplazan esa aceptación visual.
