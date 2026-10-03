export function activeFilter(status?: string) {
  return status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {};
}

export function matchesContact(row: { name: string; phone: string | null; email: string | null }, query: string) {
  const q = query.trim().toLocaleLowerCase("es");
  if (!q || [row.name, row.email, row.phone].some(value => value?.toLocaleLowerCase("es").includes(q))) return true;
  // Ignore formatting when searching a phone, but never interpret letters as digits.
  const digits = q.replace(/\D/g, "");
  return Boolean(digits && /^[+\d\s().-]+$/.test(q) && row.phone?.replace(/\D/g, "").includes(digits));
}

export function displayPhone(phone: string | null) {
  if (!phone) return "Sin teléfono";
  // Only an explicit Chilean international prefix is safe to format.
  const compact = phone.replace(/[\s().-]/g, "");
  const match = /^(?:\+56|0056)(9\d{8})$/.exec(compact);
  return match ? `+56 ${match[1][0]} ${match[1].slice(1, 5)} ${match[1].slice(5)}` : phone;
}
