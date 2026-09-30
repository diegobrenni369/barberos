-- CreateEnum
CREATE TYPE "CommissionSettlementStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "CommissionSettlement" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "barberName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalSales" DECIMAL(14,2) NOT NULL,
    "totalCommission" DECIMAL(14,2) NOT NULL,
    "status" "CommissionSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionSettlementItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "saleAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CommissionSettlementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionSettlement_barbershopId_paidAt_idx" ON "CommissionSettlement"("barbershopId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlement_id_barbershopId_barberId_key" ON "CommissionSettlement"("id", "barbershopId", "barberId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlementItem_commissionId_key" ON "CommissionSettlementItem"("commissionId");

-- CreateIndex
CREATE INDEX "CommissionSettlementItem_barbershopId_settlementId_idx" ON "CommissionSettlementItem"("barbershopId", "settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlementItem_commissionId_barbershopId_barberId_key" ON "CommissionSettlementItem"("commissionId", "barbershopId", "barberId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_id_barbershopId_barberId_key" ON "Commission"("id", "barbershopId", "barberId");

-- AddForeignKey
ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSettlement" ADD CONSTRAINT "CommissionSettlement_barberId_barbershopId_fkey" FOREIGN KEY ("barberId", "barbershopId") REFERENCES "Barber"("id", "barbershopId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSettlementItem" ADD CONSTRAINT "CommissionSettlementItem_settlementId_barbershopId_barberI_fkey" FOREIGN KEY ("settlementId", "barbershopId", "barberId") REFERENCES "CommissionSettlement"("id", "barbershopId", "barberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSettlementItem" ADD CONSTRAINT "CommissionSettlementItem_commissionId_barbershopId_barberI_fkey" FOREIGN KEY ("commissionId", "barbershopId", "barberId") REFERENCES "Commission"("id", "barbershopId", "barberId") ON DELETE RESTRICT ON UPDATE CASCADE;
