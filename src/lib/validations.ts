import { z } from "zod";

const optionalText = z.string().trim().max(120).optional().or(z.literal(""));

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
  timezone: z.string().min(1),
  currency: z.string().length(3),
});
