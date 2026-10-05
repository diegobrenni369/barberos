# Branding público e imágenes

Crear/conectar un store **público** de Vercel Blob. Fuera de Vercel configurar
`BLOB_READ_WRITE_TOKEN` únicamente en servidor. En Vercel también puede usarse
la autenticación OIDC del store conectado (`BLOB_STORE_ID`). Nunca NEXT_PUBLIC.
No se crean stores ni credenciales automáticamente.

Patrón: [server uploads de Vercel](https://vercel.com/docs/vercel-blob/server-upload)
y [SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk). El navegador envía
bytes a `/api/public-images`; el servidor autentica OWNER, comprueba tenant/origen,
limita a 3 MB y valida JPEG/PNG/WebP estático mediante decodificación Sharp
(hasta 16 megapíxeles). Re-encoding WebP elimina metadata; sin cropper ni pipeline
avanzado. Solo se guarda la URL en PostgreSQL.

Las imágenes se guardan inmediatamente, independientemente del resto del formulario.
Para servicios primero crear el registro y después subir en Editar. Foto del barbero
en su ficha, solo OWNER. Logo/portada y descripción/Instagram en Configuración.

La sustitución usa compare-and-set; la limpieza del blob anterior es best-effort
y solo sobre nuestro namespace tenant/registro. Si Blob falla durante limpieza o
se interrumpe el proceso, pueden quedar archivos huérfanos: revisar storage antes
de eliminarlos manualmente. El hard delete de registros no borra blobs automáticamente.

Aplicar `20261002010000_public_branding` y generar Prisma Client. Si el servidor dev
ya estaba corriendo con otro cliente, reiniciarlo. Todos los campos son opcionales;
sin token de Blob se puede usar booking normalmente, pero no subir imágenes.

No se probaron uploads reales: en este entorno no hay credenciales configuradas.
No se han modificado disponibilidad, matching, concurrencia ni políticas de pago.

## Validación de esta entrega

- Migración aplicada en la base local y Prisma Client generado.
- Lint, TypeScript y git diff --check correctos; sin build ni suites amplias.
- Comprobación móvil 375/390/430 pendiente: el servidor dev existente sigue usando
  el cliente Prisma anterior (`Unknown field` al consultar branding). Reiniciar
  `npm run dev` antes de la revisión manual. No se declara el smoke móvil aprobado.
- Portada limitada a 128 px en móvil; thumbnails 48 px y avatares 40 px, con
  fallback ante ausencia/error de imagen. Confirmación conserva su diseño actual.
