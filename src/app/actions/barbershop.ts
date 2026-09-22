"use server";

import { DayOfWeek, MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barbershopSchema, businessHoursSchema } from "@/lib/validations";
import { timeToMinute } from "@/lib/barber-availability";

function errorUrl(path: string, message: string) { return `${path}?error=${encodeURIComponent(message)}`; }
const ONBOARDING_TRANSACTION_RETRIES = 3;

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function createBarbershop(formData: FormData) {
  const user = await requireAuth();
  const parsed = barbershopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl("/onboarding", parsed.error.issues[0].message));
  for (let attempt = 0; attempt < ONBOARDING_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const existingMembership = await tx.barbershopMembership.findFirst({ where: { userId: user.id } });
        if (existingMembership) return false;
        const barbershop = await tx.barbershop.create({ data: { ...parsed.data, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null } });
        await tx.barbershopMembership.create({ data: { userId: user.id, barbershopId: barbershop.id, role: MembershipRole.OWNER } });
        await tx.barbershopBusinessHour.createMany({ data: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY].map((dayOfWeek) => ({ barbershopId: barbershop.id, dayOfWeek, opensMinute: 480, closesMinute: 1200 })) });
        await tx.blockReason.createMany({ data: ["Trámite personal", "Médico", "Capacitación", "Reunión", "Permiso", "Vacaciones", "Ausencia", "Otro"].map((name) => ({ barbershopId: barbershop.id, name })) });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!created) redirect("/dashboard");
      redirect("/dashboard");
    } catch (error) {
      if (isSerializationConflict(error) && attempt < ONBOARDING_TRANSACTION_RETRIES - 1) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect(errorUrl("/onboarding", "Ese slug ya está en uso"));
      if (isSerializationConflict(error)) redirect(errorUrl("/onboarding", "No pudimos crear la barbería. Intenta nuevamente."));
      throw error;
    }
  }
  redirect(errorUrl("/onboarding", "No pudimos crear la barbería. Intenta nuevamente."));
}

export async function saveBusinessHours(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER); let schedule: unknown;
  try { schedule = JSON.parse(String(formData.get("schedule"))); } catch { redirect(errorUrl("/settings", "Horario inválido")); }
  const parsed = businessHoursSchema.safeParse({ schedule });
  if (!parsed.success) redirect(errorUrl("/settings", parsed.error.issues[0].message));
  if (new Set(parsed.data.schedule.map((item) => item.dayOfWeek)).size !== 7) redirect(errorUrl("/settings", "El horario contiene días duplicados"));
  const rows = parsed.data.schedule.map((item) => ({ barbershopId: membership.barbershopId, dayOfWeek: item.dayOfWeek, opensMinute: timeToMinute(item.opensAt), closesMinute: timeToMinute(item.closesAt), isClosed: item.isClosed }));
  if (rows.some((item) => !item.isClosed && item.opensMinute >= item.closesMinute)) redirect(errorUrl("/settings", "La apertura debe ser anterior al cierre"));
  const customAvailability = await prisma.barberAvailability.findMany({ where: { barbershopId: membership.barbershopId }, select: { dayOfWeek: true, startMinute: true, endMinute: true } });
  if (customAvailability.some((item) => { const hours = rows.find((row) => row.dayOfWeek === item.dayOfWeek); return !hours || hours.isClosed || item.startMinute < hours.opensMinute || item.endMinute > hours.closesMinute; })) redirect(errorUrl("/settings", "Hay horarios de barberos fuera del nuevo horario de atención"));
  await prisma.$transaction(async (tx) => { await tx.barbershopBusinessHour.deleteMany({ where: { barbershopId: membership.barbershopId } }); await tx.barbershopBusinessHour.createMany({ data: rows }); });
  revalidatePath("/settings"); revalidatePath("/agenda"); redirect("/settings?success=Horario+guardado");
}

export async function updateBarbershop(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = barbershopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl("/settings", parsed.error.issues[0].message));
  try {
    await prisma.barbershop.update({
      where: { id: membership.barbershopId },
      data: { ...parsed.data, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") redirect(errorUrl("/settings", "Ese slug ya está en uso"));
    throw error;
  }
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?success=Configuración+guardada");
}
