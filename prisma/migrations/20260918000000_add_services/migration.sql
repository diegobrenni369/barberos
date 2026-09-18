CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Service_barbershopId_idx" ON "Service"("barbershopId");
ALTER TABLE "Service" ADD CONSTRAINT "Service_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
