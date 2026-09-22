CREATE TYPE "DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

CREATE TABLE "BarberAvailability" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarberAvailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BarberAvailability_valid_minutes" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
);

CREATE TABLE "BarberBlock" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarberBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BarberBlock_valid_range" CHECK ("startsAt" < "endsAt")
);

CREATE INDEX "BarberAvailability_barbershopId_barberId_dayOfWeek_idx" ON "BarberAvailability"("barbershopId", "barberId", "dayOfWeek");
CREATE INDEX "BarberAvailability_barberId_dayOfWeek_startMinute_idx" ON "BarberAvailability"("barberId", "dayOfWeek", "startMinute");
CREATE INDEX "BarberBlock_barbershopId_startsAt_idx" ON "BarberBlock"("barbershopId", "startsAt");
CREATE INDEX "BarberBlock_barbershopId_barberId_startsAt_idx" ON "BarberBlock"("barbershopId", "barberId", "startsAt");
CREATE INDEX "BarberBlock_barberId_startsAt_endsAt_idx" ON "BarberBlock"("barberId", "startsAt", "endsAt");

ALTER TABLE "BarberAvailability" ADD CONSTRAINT "BarberAvailability_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberAvailability" ADD CONSTRAINT "BarberAvailability_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
