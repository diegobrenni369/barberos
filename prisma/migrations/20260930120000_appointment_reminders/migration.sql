-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FIRST_REMINDER', 'FINAL_REMINDER');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "customerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "reminderRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "type" "ReminderType" NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentPublicAccess" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentPublicAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentReminder_status_scheduledFor_idx" ON "AppointmentReminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AppointmentReminder_barbershopId_appointmentId_status_idx" ON "AppointmentReminder"("barbershopId", "appointmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_revision_type_channel_key" ON "AppointmentReminder"("appointmentId", "revision", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentPublicAccess_tokenHash_key" ON "AppointmentPublicAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "AppointmentPublicAccess_barbershopId_appointmentId_revokedA_idx" ON "AppointmentPublicAccess"("barbershopId", "appointmentId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_id_barbershopId_key" ON "Appointment"("id", "barbershopId");

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_barbershopId_fkey" FOREIGN KEY ("appointmentId", "barbershopId") REFERENCES "Appointment"("id", "barbershopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentPublicAccess" ADD CONSTRAINT "AppointmentPublicAccess_appointmentId_barbershopId_fkey" FOREIGN KEY ("appointmentId", "barbershopId") REFERENCES "Appointment"("id", "barbershopId") ON DELETE CASCADE ON UPDATE CASCADE;
