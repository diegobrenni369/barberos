import { z } from "zod";
import { normalizeBookingPhone } from "@/lib/public-booking-input";

// Manual entry still accepts legacy/local contact values and an empty phone.
export function normalizeCustomerPhone(value?: string | null) {
  const phone = value?.trim();
  if (!phone) return null;
  if (!/^[+\d\s().-]+$/.test(phone)) return phone;
  const normalized = normalizeBookingPhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : phone;
}

export function customerEnrichment(existing: { name: string; email: string | null }, incoming: { name: string; email?: string }) {
  const data: { name?: string; email?: string } = {};
  const name = incoming.name.trim().replace(/\s+/g, " ");
  // Only append whole words to the existing name; no fuzzy or substring match.
  const words = (value: string) => value.trim().normalize("NFC").toLocaleLowerCase("es").split(/\s+/).filter(Boolean);
  const before = words(existing.name);
  const after = words(name);
  if (name && (!before.length || (after.length > before.length && before.every((word, index) => word === after[index])))) data.name = name;
  const email = incoming.email?.trim().toLowerCase();
  if (!existing.email?.trim() && email && z.email().safeParse(email).success) data.email = email;
  return data;
}
