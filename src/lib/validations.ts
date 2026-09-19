import { z } from "zod";

const optionalText = z.string().trim().max(120).optional().or(z.literal(""));

const ianaTimezone = z.string().trim().refine(
  (timezone) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },
  "Ingresa una zona horaria IANA válida",
);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  email: z.email("Ingresa un correo válido").toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
});

export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido").toLowerCase(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const barbershopSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre de la barbería").max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones").min(3).max(60),
  phone: optionalText,
  email: z.email("Ingresa un correo válido").optional().or(z.literal("")),
  address: optionalText,
  timezone: ianaTimezone,
  currency: z.literal("CLP", "La moneda soportada actualmente es CLP"),
});

const optionalContact = z.string().trim().max(120).optional().or(z.literal(""));
export const barberSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre").max(100),
  phone: optionalContact,
  email: z.email("Ingresa un correo válido").optional().or(z.literal("")),
  commissionRate: z.coerce.number().min(0, "La comisión no puede ser negativa").max(100, "La comisión no puede superar 100").default(0),
  isActive: z.coerce.boolean().default(true),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int("La duración debe ser un número entero").positive("La duración debe ser mayor a cero"),
  price: z.coerce.number().finite("Ingresa un precio válido").min(0, "El precio no puede ser negativo"),
  isActive: z.coerce.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del cliente").max(100),
  phone: optionalContact,
  email: z.email("Ingresa un correo válido").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});
