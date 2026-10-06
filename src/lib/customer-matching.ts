import { z } from "zod";
import { normalizeBookingPhone } from "@/lib/public-booking-input";
import type { Prisma } from "@prisma/client";

// Caller owns the transaction and validates/normalizes the contact input.
export async function matchOrCreateCustomer(tx: Prisma.TransactionClient, barbershopId: string, input: { name: string; phone: string; email?: string }) {
  const digits = input.phone.slice(1);
  const local = digits.startsWith("56") && digits.length === 11 ? digits.slice(2) : digits;
  const matches = await tx.$queryRaw<{ id: string; name: string; email: string | null }[]>`
    SELECT "id", "name", "email" FROM "Customer"
    WHERE "barbershopId" = ${barbershopId}
      AND regexp_replace(regexp_replace("phone", '[^0-9]', '', 'g'), '^00', '') IN (${digits}, ${local})
    ORDER BY "createdAt", "id" LIMIT 1
  `;
  if (matches[0]) {
    const enrichment = customerEnrichment(matches[0], input);
    if (Object.keys(enrichment).length) await tx.customer.updateMany({ where: { id: matches[0].id, barbershopId }, data: enrichment });
    return matches[0];
  }
  return tx.customer.create({ data: { barbershopId, name: input.name, phone: input.phone, email: input.email || null }, select: { id: true } });
}

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
