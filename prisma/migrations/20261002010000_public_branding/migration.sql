ALTER TABLE "Barbershop"
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "coverImageUrl" TEXT,
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Barber" ADD COLUMN "publicImageUrl" TEXT;
ALTER TABLE "Service" ADD COLUMN "publicImageUrl" TEXT;
