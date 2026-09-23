import { z } from "zod";

// Independent from visual TimeGrid density: can evolve separately in 6B.
export const PUBLIC_SLOT_MINUTES = 30;
export const PUBLIC_BOOKING_DAYS = 90;
export const publicSlug = z.string().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export function normalizeBookingPhone(value: string) {
  let digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 9) digits = `56${digits}`;
  return `+${digits}`;
}
export const publicSlotInput = z.object({
  slug: publicSlug,
  serviceId: z.string().cuid(),
  barberId: z.string().cuid().nullable(), // null means search strategy, never a stored barber ID.
  date: z.iso.date(),
}).strict();
export const publicBookingInput = publicSlotInput.extend({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().trim().min(2, "Ingresa tu nombre").max(100),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]+$/, "Ingresa un teléfono válido")
    .transform(normalizeBookingPhone).refine(value => /^\+[1-9]\d{7,14}$/.test(value), "Ingresa un teléfono válido"),
  email: z.email("Ingresa un correo válido").max(254).toLowerCase().optional().or(z.literal("")),
}).strict();
export type PublicSlotInput = z.infer<typeof publicSlotInput>;
export type BookingConfirmation = { service: string; barber: string; shop: string; date: string; time: string };
