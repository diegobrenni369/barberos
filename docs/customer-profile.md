# Cliente 360°

Ruta privada `/customers/[id]`, tenant obtenido de la membership. Un ID ajeno o inexistente devuelve 404 antes de consultar métricas.

- Atenciones y preferencias: Appointment COMPLETED; empate por ID ascendente. Preferencias muestran el nombre actual de la relación, no constituyen reporting financiero.
- Última visita: última COMPLETED anterior al momento de consulta. Próxima: primera SCHEDULED/CONFIRMED desde ese momento.
- Gastado: suma Decimal de Sale.total con status COMPLETED. Ticket: suma/cantidad de esas ventas, independientemente de pagos o atenciones. VOIDED excluidas.
- Historial: startsAt anterior a ahora y estado COMPLETED, CANCELLED o NO_SHOW, 10 registros por página con orden estable fecha/ID. El conteo de paginación utiliza el mismo filtro. Servicio de SaleItem.description cuando hay venta válida; importe histórico Sale.total (no se etiqueta como pagado). Sin venta: relación Service actual e importe vacío.
- Citas activas pasadas: quedan fuera del historial, sin modificar ni eliminar registros y sin contarlas como atenciones, cancelaciones o no-show. Siguen disponibles en Agenda en su fecha original. No se agrega una sección nueva a la ficha.
- Conteos calculados en PostgreSQL, sin columnas derivadas ni consultas por fila. Consultas siempre restringidas por tenant; relaciones de venta verificadas también por customer/tenant.
- Fechas y enlaces a Agenda usan timezone de la barbería. Moneda histórica en historial y moneda de barbería en KPIs (V1 CLP). No conversión cambiaria.
- Edición reutiliza CustomerDialog y updateCustomer; al guardar vuelve a la lista, como el flujo existente. Crear reserva reutiliza AppointmentDialog con un único cliente preseleccionado y redirige a Agenda mediante la acción existente. Cliente inactivo no puede crear reserva.
- UI responsive: KPIs 2x2 en móvil, historial en filas apiladas sin tabla horizontal.

Prueba local: `npx tsx tests/customer-profile.integration.ts`. Fixtures en tenants dedicados, sin usuarios ni cambios a seed; limpieza en finally.
