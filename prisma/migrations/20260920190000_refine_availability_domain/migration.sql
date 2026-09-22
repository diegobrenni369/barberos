CREATE TABLE "BarbershopBusinessHour" (
  "id" TEXT NOT NULL, "barbershopId" TEXT NOT NULL, "dayOfWeek" "DayOfWeek" NOT NULL,
  "opensMinute" INTEGER NOT NULL, "closesMinute" INTEGER NOT NULL, "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarbershopBusinessHour_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BarbershopBusinessHour_valid_minutes" CHECK ("opensMinute" >= 0 AND "closesMinute" <= 1440 AND ("isClosed" OR "opensMinute" < "closesMinute"))
);
CREATE UNIQUE INDEX "BarbershopBusinessHour_barbershopId_dayOfWeek_key" ON "BarbershopBusinessHour"("barbershopId", "dayOfWeek");
CREATE INDEX "BarbershopBusinessHour_barbershopId_idx" ON "BarbershopBusinessHour"("barbershopId");
ALTER TABLE "BarbershopBusinessHour" ADD CONSTRAINT "BarbershopBusinessHour_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BlockReason" (
  "id" TEXT NOT NULL, "barbershopId" TEXT NOT NULL, "name" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlockReason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlockReason_barbershopId_name_key" ON "BlockReason"("barbershopId", "name");
CREATE INDEX "BlockReason_barbershopId_isActive_idx" ON "BlockReason"("barbershopId", "isActive");
ALTER TABLE "BlockReason" ADD CONSTRAINT "BlockReason_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BarbershopBusinessHour" ("id", "barbershopId", "dayOfWeek", "opensMinute", "closesMinute", "isClosed", "updatedAt")
SELECT 'hours-' || b."id" || '-' || d.day, b."id", d.day::"DayOfWeek", 480, 1200, false, CURRENT_TIMESTAMP
FROM "Barbershop" b CROSS JOIN (VALUES ('MONDAY'),('TUESDAY'),('WEDNESDAY'),('THURSDAY'),('FRIDAY'),('SATURDAY'),('SUNDAY')) d(day);

INSERT INTO "BlockReason" ("id", "barbershopId", "name", "updatedAt")
SELECT 'reason-' || b."id" || '-' || r.slug, b."id", r.name, CURRENT_TIMESTAMP
FROM "Barbershop" b CROSS JOIN (VALUES ('personal','Trámite personal'),('medical','Médico'),('training','Capacitación'),('meeting','Reunión'),('leave','Permiso'),('vacation','Vacaciones'),('absence','Ausencia'),('other','Otro')) r(slug,name);

ALTER TABLE "BarberBlock" ADD COLUMN "reasonId" TEXT;
ALTER TABLE "BarberBlock" RENAME COLUMN "reason" TO "note";
UPDATE "BarberBlock" SET "reasonId" = 'reason-' || "barbershopId" || '-other';
ALTER TABLE "BarberBlock" ALTER COLUMN "reasonId" SET NOT NULL;
CREATE INDEX "BarberBlock_reasonId_idx" ON "BarberBlock"("reasonId");
ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "BlockReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
