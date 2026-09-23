CREATE UNIQUE INDEX "Barber_id_barbershopId_key" ON "Barber"("id", "barbershopId");
CREATE UNIQUE INDEX "Service_id_barbershopId_key" ON "Service"("id", "barbershopId");

CREATE TABLE "BarberService" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BarberService_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BarberService_barberId_serviceId_key" ON "BarberService"("barberId", "serviceId");
CREATE INDEX "BarberService_serviceId_idx" ON "BarberService"("serviceId");
CREATE INDEX "BarberService_barbershopId_serviceId_idx" ON "BarberService"("barbershopId", "serviceId");
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_barberId_barbershopId_fkey"
  FOREIGN KEY ("barberId", "barbershopId") REFERENCES "Barber"("id", "barbershopId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_serviceId_barbershopId_fkey"
  FOREIGN KEY ("serviceId", "barbershopId") REFERENCES "Service"("id", "barbershopId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the former all-professionals eligibility, including reactivation.
-- No appointments are changed. New records after migration require explicit links.
INSERT INTO "BarberService" ("id", "barbershopId", "barberId", "serviceId")
SELECT 'backfill-' || md5(b."id" || ':' || s."id"), b."barbershopId", b."id", s."id"
FROM "Barber" b JOIN "Service" s ON s."barbershopId" = b."barbershopId";
