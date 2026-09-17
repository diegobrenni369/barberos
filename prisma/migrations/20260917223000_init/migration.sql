CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'BARBER');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Barbershop" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "address" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Santiago', "currency" TEXT NOT NULL DEFAULT 'CLP', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Barbershop_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BarbershopMembership" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "barbershopId" TEXT NOT NULL, "role" "MembershipRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarbershopMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Barber" (
  "id" TEXT NOT NULL, "barbershopId" TEXT NOT NULL, "userId" TEXT, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT,
  "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Barbershop_slug_key" ON "Barbershop"("slug");
CREATE INDEX "BarbershopMembership_barbershopId_idx" ON "BarbershopMembership"("barbershopId");
CREATE UNIQUE INDEX "BarbershopMembership_userId_barbershopId_key" ON "BarbershopMembership"("userId", "barbershopId");
CREATE INDEX "Barber_barbershopId_idx" ON "Barber"("barbershopId");
CREATE INDEX "Barber_userId_idx" ON "Barber"("userId");
ALTER TABLE "BarbershopMembership" ADD CONSTRAINT "BarbershopMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarbershopMembership" ADD CONSTRAINT "BarbershopMembership_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
