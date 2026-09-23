import { z } from "zod";
import { Prisma } from "@prisma/client";

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
  price: z.coerce.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Ingresa un precio válido"),
  isActive: z.union([z.boolean(), z.enum(["true", "false"])]).default(true).transform(value => value === true || value === "true"),
  isOnlineBookingEnabled: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  onlinePaymentPolicy: z.enum(["NONE", "OPTIONAL", "FULL", "DEPOSIT"]).default("NONE"),
  depositAmount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Ingresa un abono válido").optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  // Zod refinements may run after a regex issue; never pass invalid text to Decimal.
  const moneyText = /^\d{1,10}(\.\d{1,2})?$/;
  if (!moneyText.test(data.price) || (data.depositAmount && !moneyText.test(data.depositAmount))) return;
  if (data.onlinePaymentPolicy === "DEPOSIT") {
    if (!data.depositAmount || new Prisma.Decimal(data.depositAmount).lte(0) || new Prisma.Decimal(data.depositAmount).gt(data.price)) {
      ctx.addIssue({ code: "custom", path: ["depositAmount"], message: "El abono debe ser mayor a cero y no superar el precio" });
    }
  } else if (data.depositAmount) {
    ctx.addIssue({ code: "custom", path: ["depositAmount"], message: "El abono solo aplica a la política Solicitar abono" });
  }
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del cliente").max(100),
  phone: optionalContact,
  email: z.email("Ingresa un correo válido").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});

export const appointmentSchema = z.object({
  id: z.string().cuid().optional().or(z.literal("")),
  customerId: z.string().cuid("Selecciona un cliente"),
  barberId: z.string().cuid("Selecciona un barbero"),
  serviceId: z.string().cuid("Selecciona un servicio"),
  date: z.iso.date("Selecciona una fecha válida"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora válida"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("SCHEDULED"),
});

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresa una hora válida");
export const weeklyAvailabilitySchema = z.object({
  barberId: z.string().cuid("Barbero inválido"),
  schedule: z.array(z.object({
    dayOfWeek: z.enum(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
    enabled: z.boolean(),
    startTime: clockTime,
    endTime: clockTime,
    breaks: z.array(z.object({
      startTime: clockTime,
      endTime: clockTime,
      label: z.string().trim().max(80, "La etiqueta es demasiado larga").optional().or(z.literal("")),
    })).max(8, "Hay demasiados descansos para un día"),
  })).length(7),
});

export const businessHoursSchema = z.object({
  schedule: z.array(z.object({
    dayOfWeek: z.enum(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
    isClosed: z.boolean(),
    opensAt: clockTime,
    closesAt: clockTime,
  })).length(7),
});

const barberBlockBaseSchema = z.object({
  barberId: z.string().cuid("Selecciona un barbero"),
  date: z.iso.date("Selecciona una fecha válida"),
  startTime: clockTime,
  endTime: clockTime,
  allDay: z.string().optional().transform((value) => value === "true"),
  reasonId: z.string().min(1, "Selecciona un motivo"),
  note: z.string().trim().max(500, "La nota es demasiado larga").optional().or(z.literal("")),
});

export const createBarberBlockSchema = barberBlockBaseSchema;
export const updateBarberBlockSchema = barberBlockBaseSchema.extend({
  id: z.string().cuid("Bloqueo inválido"),
});
