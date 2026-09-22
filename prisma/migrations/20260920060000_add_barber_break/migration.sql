CREATE TABLE "BarberBreak" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarberBreak_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BarberBreak_valid_minutes" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
);

CREATE INDEX "BarberBreak_barbershopId_barberId_dayOfWeek_idx" ON "BarberBreak"("barbershopId", "barberId", "dayOfWeek");
CREATE INDEX "BarberBreak_barberId_dayOfWeek_startMinute_idx" ON "BarberBreak"("barberId", "dayOfWeek", "startMinute");

ALTER TABLE "BarberBreak" ADD CONSTRAINT "BarberBreak_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberBreak" ADD CONSTRAINT "BarberBreak_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
