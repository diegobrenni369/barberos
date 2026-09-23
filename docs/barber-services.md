# Profesionales por servicio (Fase 6B.0)

## Modelo y migración

`BarberService` contiene `id`, `barbershopId`, `barberId`, `serviceId` y `createdAt`.
El par barber/service es único; su índice cubre consultas por barberId. Hay índices
por serviceId y tenant/service. Las dos claves foráneas compuestas comparten
barbershopId: PostgreSQL impide relaciones entre tenants incluso fuera de la UI.
Cascade elimina únicamente asociaciones si se elimina su profesional/servicio;
Appointment conserva sus restricciones previas, sin relación dependiente del join.

La migración hace un backfill completo Barber × Service **dentro de cada tenant**,
incluidos inactivos. Preserva la elegibilidad anterior y su posterior reactivación.
No modifica ninguna Appointment. Es una migración única, no una sincronización
periódica. Los profesionales nuevos no reciben servicios automáticamente: deben
asignarse desde Servicios. El seed crea la relación solo al crear sus servicios,
sin sobrescribir selecciones de servicios ya existentes al volver a ejecutarlo.

## Administración

El OWNER elige profesionales activos dentro del diálogo de servicio. Para un
servicio nuevo, todos los activos aparecen seleccionados inicialmente. Puede
desmarcarlos todos si no habilita el servicio activo para reserva online.
Activar un servicio online también exige al menos una asociación activa.
Desactivar posteriormente el último profesional no elimina asociaciones: el
servicio deja de mostrarse públicamente mientras no tenga profesionales activos.

Tenant siempre procede de membership autenticada. Validación, guardado de servicio
y asociaciones se ejecutan atómicamente en SERIALIZABLE; guardado reintenta P2034.
No se pueden enviar IDs de otro tenant ni crear asociaciones nuevas con inactivos.
Editar un servicio conserva sus asociaciones inactivas ya existentes.

## Reservas

Backoffice filtra profesionales por servicio y fuerza una nueva selección si el
profesional deja de ser elegible. Crear, editar, mover o restaurar comprueba la
asociación activa dentro de la transacción. El drag conserva snap, colisiones,
rollback y geometría; agrega solo una condición de elegibilidad y mensaje específico.

Eliminar una relación no altera reservas existentes, futuras o pasadas. Se pueden
seguir consultando y gestionando sus estados mediante Quick View, incluida su
cancelación; cobro permanece intacto. Editar/reprogramar/restaurar requiere una
asociación vigente, incluso si se conserva el profesional anterior. Un cambio de
estado que restaura desde CANCELLED también vuelve a comprobar elegibilidad.

Reserva pública muestra únicamente profesionales activos asociados. ANY considera
solo esos candidatos en ID ascendente, con el mismo motor de disponibilidad.
Profesional específico no asociado produce cero slots. La confirmación vuelve a
cargar asociaciones, servicio, actividad y disponibilidad en SERIALIZABLE con el
retry existente. Una selección antigua no autoriza una nueva reserva.

## Pruebas

Contra PostgreSQL local, con tenants aleatorios y cleanup:

```sh
npx tsx tests/barber-service.integration.ts
npx tsx tests/public-booking.integration.ts
npx tsx tests/cash.integration.ts
```

La suite de elegibilidad cubre matrices A/Diego/Juan y B/Esteban, FK multi-tenant,
unicidad, guard server-side, slots, ANY concurrente/determinista, movimientos válidos
e inválidos, rollback, reservas existentes y reactivación. La suite pública conserva
sus pruebas previas con asociaciones explícitas en las fixtures. Caja no se cambia.
