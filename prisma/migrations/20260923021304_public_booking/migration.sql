-- CreateEnum
CREATE TYPE "OnlinePaymentPolicy" AS ENUM ('NONE', 'OPTIONAL', 'FULL', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('INTERNAL', 'ONLINE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "depositAmount" DECIMAL(12,2),
ADD COLUMN     "isOnlineBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlinePaymentPolicy" "OnlinePaymentPolicy" NOT NULL DEFAULT 'NONE';
