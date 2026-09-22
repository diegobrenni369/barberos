"use server";

import { AppointmentStatus, MembershipRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { zonedDateTimeToUtc } from "@/lib/agenda";
import { ensureBarberAvailable, ensureNoBarberBlock, ensureNoBarberBreak } from "@/lib/barber-availability";
import { prisma } from "@/lib/prisma";
import { appointmentSchema } from "@/lib/validations";

function fail(date: string, message: string): never { redirect(`/agenda?date=${date}&error=${encodeURIComponent(message)}`); }
function availabilityError(error: Error) {
  if (error.message === "BARBERSHOP_CLOSED") return "La barbería está cerrada en esa fecha";
  if (error.message === "OUTSIDE_BUSINESS_HOURS") return "El horario está fuera del horario de atención";
  if (error.message === "OUTSIDE_AVAILABILITY") return "El horario está fuera de la disponibilidad del barbero";
}

async function appointmentData(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("date") || ""), parsed.error.issues[0].message);
  const data = parsed.data;
  const [barber, customer, service] = await Promise.all([
    prisma.barber.findFirst({ where: { id: data.barberId, barbershopId: membership.barbershopId, isActive: true } }),
    prisma.customer.findFirst({ where: { id: data.customerId, barbershopId: membership.barbershopId, isActive: true } }),
    prisma.service.findFirst({ where: { id: data.serviceId, barbershopId: membership.barbershopId, isActive: true } }),
  ]);
  if (!barber) fail(data.date, "El barbero no está disponible");
  if (!customer) fail(data.date, "El cliente no es válido");
  if (!service) fail(data.date, "El servicio no está disponible");
  const startsAt = zonedDateTimeToUtc(data.date, data.time, membership.barbershop.timezone);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  return { membership, data, service, startsAt, endsAt };
}

async function ensureNoOverlap(tx: Prisma.TransactionClient, barbershopId: string, barberId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  const conflict = await tx.appointment.findFirst({ where: { barbershopId, barberId, status: { not: AppointmentStatus.CANCELLED }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (conflict) throw new Error("APPOINTMENT_OVERLAP");
}

export async function createAppointment(formData: FormData) {
  const { membership, data, service, startsAt, endsAt } = await appointmentData(formData);
  try {
    await prisma.$transaction(async (tx) => {
      await ensureBarberAvailable(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt, timezone: membership.barbershop.timezone });
      await ensureNoBarberBreak(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt, timezone: membership.barbershop.timezone });
      await ensureNoBarberBlock(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt });
      await ensureNoOverlap(tx, membership.barbershopId, data.barberId, startsAt, endsAt);
      await tx.appointment.create({ data: { barbershopId: membership.barbershopId, barberId: data.barberId, customerId: data.customerId, serviceId: data.serviceId, startsAt, endsAt, price: service.price, notes: data.notes || null, status: data.status } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && availabilityError(error)) fail(data.date, availabilityError(error)!);
    if (error instanceof Error && error.message === "BARBER_BREAK") fail(data.date, "El horario coincide con un descanso del barbero");
    if (error instanceof Error && error.message === "BARBER_BLOCKED") fail(data.date, "El barbero tiene un bloqueo en ese horario");
    if (error instanceof Error && (error.message === "APPOINTMENT_OVERLAP" || (error as { code?: string }).code === "P2034")) fail(data.date, "Ese horario ya está ocupado para el barbero seleccionado");
    throw error;
  }
  revalidatePath("/agenda"); redirect(`/agenda?date=${data.date}`);
}

export async function updateAppointment(formData: FormData) {
  const { membership, data, service, startsAt, endsAt } = await appointmentData(formData);
  const id = data.id;
  if (!id) fail(data.date, "Reserva no encontrada");
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findFirst({ where: { id, barbershopId: membership.barbershopId }, select: { id: true } });
      if (!current) throw new Error("APPOINTMENT_NOT_FOUND");
      if (data.status !== "CANCELLED") {
        await ensureBarberAvailable(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt, timezone: membership.barbershop.timezone });
        await ensureNoBarberBreak(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt, timezone: membership.barbershop.timezone });
        await ensureNoBarberBlock(tx, { barbershopId: membership.barbershopId, barberId: data.barberId, startsAt, endsAt });
        await ensureNoOverlap(tx, membership.barbershopId, data.barberId, startsAt, endsAt, id);
      }
      await tx.appointment.updateMany({ where: { id, barbershopId: membership.barbershopId }, data: { barberId: data.barberId, customerId: data.customerId, serviceId: data.serviceId, startsAt, endsAt, price: service.price, notes: data.notes || null, status: data.status } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "APPOINTMENT_NOT_FOUND") fail(data.date, "Reserva no encontrada");
    if (error instanceof Error && availabilityError(error)) fail(data.date, availabilityError(error)!);
    if (error instanceof Error && error.message === "BARBER_BREAK") fail(data.date, "El horario coincide con un descanso del barbero");
    if (error instanceof Error && error.message === "BARBER_BLOCKED") fail(data.date, "El barbero tiene un bloqueo en ese horario");
    if (error instanceof Error && (error.message === "APPOINTMENT_OVERLAP" || (error as { code?: string }).code === "P2034")) fail(data.date, "Ese horario ya está ocupado para el barbero seleccionado");
    throw error;
  }
  revalidatePath("/agenda"); redirect(`/agenda?date=${data.date}`);
}

export async function restoreAppointment(formData: FormData) {
  const membership = await requireRole(MembershipRole.OWNER);
  const id = String(formData.get("id"));
  const date = String(formData.get("date"));
  if (!id || !date) fail(date, "Reserva no encontrada");
  try {
    await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({ where: { id, barbershopId: membership.barbershopId, status: AppointmentStatus.CANCELLED } });
      if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND");
      const barber = await tx.barber.findFirst({ where: { id: appointment.barberId, barbershopId: membership.barbershopId, isActive: true }, select: { id: true } });
      if (!barber) throw new Error("BARBER_INACTIVE");
      await ensureBarberAvailable(tx, { barbershopId: membership.barbershopId, barberId: appointment.barberId, startsAt: appointment.startsAt, endsAt: appointment.endsAt, timezone: membership.barbershop.timezone });
      await ensureNoBarberBreak(tx, { barbershopId: membership.barbershopId, barberId: appointment.barberId, startsAt: appointment.startsAt, endsAt: appointment.endsAt, timezone: membership.barbershop.timezone });
      await ensureNoBarberBlock(tx, { barbershopId: membership.barbershopId, barberId: appointment.barberId, startsAt: appointment.startsAt, endsAt: appointment.endsAt });
      await ensureNoOverlap(tx, membership.barbershopId, appointment.barberId, appointment.startsAt, appointment.endsAt, appointment.id);
      await tx.appointment.updateMany({ where: { id, barbershopId: membership.barbershopId, status: AppointmentStatus.CANCELLED }, data: { status: AppointmentStatus.SCHEDULED } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "APPOINTMENT_NOT_FOUND") fail(date, "La reserva cancelada no fue encontrada");
    if (error instanceof Error && error.message === "BARBER_INACTIVE") redirect(`/agenda?date=${date}&cancelled=true&error=${encodeURIComponent("No se puede restaurar porque el barbero no está activo")}`);
    if (error instanceof Error && availabilityError(error)) redirect(`/agenda?date=${date}&cancelled=true&error=${encodeURIComponent(`No se puede restaurar: ${availabilityError(error)!.toLowerCase()}`)}`);
    if (error instanceof Error && error.message === "BARBER_BREAK") redirect(`/agenda?date=${date}&cancelled=true&error=${encodeURIComponent("No se puede restaurar porque coincide con un descanso del barbero")}`);
    if (error instanceof Error && error.message === "BARBER_BLOCKED") redirect(`/agenda?date=${date}&cancelled=true&error=${encodeURIComponent("No se puede restaurar porque existe un bloqueo en ese horario")}`);
    if (error instanceof Error && (error.message === "APPOINTMENT_OVERLAP" || (error as { code?: string }).code === "P2034")) redirect(`/agenda?date=${date}&cancelled=true&error=${encodeURIComponent("No se puede restaurar porque el horario ya está ocupado")}`);
    throw error;
  }
  revalidatePath("/agenda"); redirect(`/agenda?date=${date}&cancelled=true`);
}
