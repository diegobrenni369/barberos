"use server";

import { AppointmentStatus, MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { zonedDateTimeToUtc } from "@/lib/agenda";
import { timeToMinute } from "@/lib/barber-availability";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBarberBlockSchema, updateBarberBlockSchema, weeklyAvailabilitySchema } from "@/lib/validations";

function agendaFail(date: string, message: string): never { redirect(`/agenda?date=${date}&error=${encodeURIComponent(message)}`); }
function barberFail(message: string): never { redirect(`/barbers?error=${encodeURIComponent(message)}`); }
type Membership = Awaited<ReturnType<typeof requireRole>>;
type CreateBlockInput = z.infer<typeof createBarberBlockSchema>;
type UpdateBlockInput = z.infer<typeof updateBarberBlockSchema>;
type BlockContext<T> = { membership: Membership; data: T; startsAt: Date; endsAt: Date };

export async function saveBarberAvailability(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  let schedule: unknown;
  try { schedule = JSON.parse(String(formData.get("schedule"))); } catch { barberFail("Horario inválido"); }
  const parsed = weeklyAvailabilitySchema.safeParse({ barberId: formData.get("barberId"), schedule });
  if (!parsed.success) barberFail(parsed.error.issues[0].message);
  const barber = await prisma.barber.findFirst({ where: { id: parsed.data.barberId, barbershopId: membership.barbershopId }, select: { id: true } });
  if (!barber) barberFail("Barbero no encontrado");
  if (new Set(parsed.data.schedule.map((day) => day.dayOfWeek)).size !== 7) barberFail("El horario semanal contiene días duplicados");
  const rows = parsed.data.schedule.filter((day) => day.enabled).map((day) => ({ barbershopId: membership.barbershopId, barberId: barber.id, dayOfWeek: day.dayOfWeek, startMinute: timeToMinute(day.startTime), endMinute: timeToMinute(day.endTime) }));
  if (!rows.length) barberFail("Configura al menos un día disponible");
  if (rows.some((row) => row.startMinute >= row.endMinute)) barberFail("La hora de inicio debe ser anterior a la hora de término");
  const businessHours = await prisma.barbershopBusinessHour.findMany({ where: { barbershopId: membership.barbershopId } });
  if (rows.some((row) => { const hours = businessHours.find((item) => item.dayOfWeek === row.dayOfWeek); return !hours || hours.isClosed || row.startMinute < hours.opensMinute || row.endMinute > hours.closesMinute; })) barberFail("El horario del barbero debe estar dentro del horario de atención");
  const breaks = parsed.data.schedule.flatMap((day) => day.enabled ? day.breaks.map((item) => ({ barbershopId: membership.barbershopId, barberId: barber.id, dayOfWeek: day.dayOfWeek, startMinute: timeToMinute(item.startTime), endMinute: timeToMinute(item.endTime), label: item.label || null })) : []);
  for (const day of parsed.data.schedule.filter((item) => item.enabled)) {
    const availability = rows.find((item) => item.dayOfWeek === day.dayOfWeek);
    if (!availability) barberFail("Horario semanal inválido");
    const dayBreaks = breaks.filter((item) => item.dayOfWeek === day.dayOfWeek).sort((a, b) => a.startMinute - b.startMinute);
    if (dayBreaks.some((item) => item.startMinute >= item.endMinute)) barberFail("La hora de inicio del descanso debe ser anterior a su término");
    if (dayBreaks.some((item) => item.startMinute < availability.startMinute || item.endMinute > availability.endMinute)) barberFail("Cada descanso debe estar dentro de la jornada");
    if (dayBreaks.some((item, index) => index > 0 && dayBreaks[index - 1].endMinute > item.startMinute)) barberFail("Los descansos no pueden superponerse");
  }
  await prisma.$transaction(async (tx) => {
    await tx.barberAvailability.deleteMany({ where: { barberId: barber.id, barbershopId: membership.barbershopId } });
    await tx.barberBreak.deleteMany({ where: { barberId: barber.id, barbershopId: membership.barbershopId } });
    if (rows.length) await tx.barberAvailability.createMany({ data: rows });
    if (breaks.length) await tx.barberBreak.createMany({ data: breaks });
  });
  revalidatePath(`/barbers/${barber.id}`); revalidatePath("/agenda"); redirect(`/barbers/${barber.id}`);
}

async function blockData(formData: FormData, mode: "create"): Promise<BlockContext<CreateBlockInput>>;
async function blockData(formData: FormData, mode: "update"): Promise<BlockContext<UpdateBlockInput>>;
async function blockData(formData: FormData, mode: "create" | "update") {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = (mode === "create" ? createBarberBlockSchema : updateBarberBlockSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) agendaFail(String(formData.get("date") || ""), parsed.error.issues[0].message);
  const data = parsed.data;
  const [barber, reason] = await Promise.all([prisma.barber.findFirst({ where: { id: data.barberId, barbershopId: membership.barbershopId, isActive: true }, select: { id: true } }), prisma.blockReason.findFirst({ where: { id: data.reasonId, barbershopId: membership.barbershopId, isActive: true }, select: { id: true } })]);
  if (!barber) agendaFail(data.date, "Barbero no disponible");
  if (!reason) agendaFail(data.date, "Motivo de bloqueo inválido");
  let startsAt: Date; let endsAt: Date;
  if (data.allDay) {
    startsAt = zonedDateTimeToUtc(data.date, "00:00", membership.barbershop.timezone);
    const next = new Date(`${data.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    endsAt = zonedDateTimeToUtc(next.toISOString().slice(0, 10), "00:00", membership.barbershop.timezone);
  } else {
    startsAt = zonedDateTimeToUtc(data.date, data.startTime, membership.barbershop.timezone);
    endsAt = zonedDateTimeToUtc(data.date, data.endTime, membership.barbershop.timezone);
  }
  if (startsAt >= endsAt) agendaFail(data.date, "La hora de inicio debe ser anterior a la hora de término");
  return { membership, data, startsAt, endsAt };
}

async function ensureNoActiveAppointment(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, startsAt: Date, endsAt: Date) {
  const appointment = await tx.appointment.findFirst({ where: { barbershopId, barberId, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
  if (appointment) throw new Error("ACTIVE_APPOINTMENT");
}

export async function createBarberBlock(formData: FormData) {
  const { membership, data, startsAt, endsAt } = await blockData(formData, "create");
  try {
    await prisma.$transaction(async (tx) => {
      await ensureNoActiveAppointment(tx, membership.barbershopId, data.barberId, startsAt, endsAt);
      await tx.barberBlock.create({ data: { barbershopId: membership.barbershopId, barberId: data.barberId, reasonId: data.reasonId, startsAt, endsAt, note: data.note || null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && (error.message === "ACTIVE_APPOINTMENT" || (error as { code?: string }).code === "P2034")) agendaFail(data.date, "No se puede bloquear un horario con reservas activas");
    throw error;
  }
  revalidatePath("/agenda"); revalidatePath(`/barbers/${data.barberId}`); redirect(`/agenda?date=${data.date}`);
}

export async function updateBarberBlock(formData: FormData) {
  const { membership, data, startsAt, endsAt } = await blockData(formData, "update");
  try {
    await prisma.$transaction(async (tx) => {
      const block = await tx.barberBlock.findFirst({ where: { id: data.id, barbershopId: membership.barbershopId }, select: { id: true } });
      if (!block) throw new Error("BLOCK_NOT_FOUND");
      await ensureNoActiveAppointment(tx, membership.barbershopId, data.barberId, startsAt, endsAt);
      await tx.barberBlock.updateMany({ where: { id: data.id, barbershopId: membership.barbershopId }, data: { barberId: data.barberId, reasonId: data.reasonId, startsAt, endsAt, note: data.note || null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "BLOCK_NOT_FOUND") agendaFail(data.date, "Bloqueo no encontrado");
    if (error instanceof Error && (error.message === "ACTIVE_APPOINTMENT" || (error as { code?: string }).code === "P2034")) agendaFail(data.date, "No se puede bloquear un horario con reservas activas");
    throw error;
  }
  revalidatePath("/agenda"); revalidatePath(`/barbers/${data.barberId}`); redirect(`/agenda?date=${data.date}`);
}

export async function deleteBarberBlock(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const id = String(formData.get("id")); const date = String(formData.get("date"));
  const result = await prisma.barberBlock.deleteMany({ where: { id, barbershopId: membership.barbershopId } });
  if (!result.count) agendaFail(date, "Bloqueo no encontrado");
  revalidatePath("/agenda"); redirect(`/agenda?date=${date}`);
}
