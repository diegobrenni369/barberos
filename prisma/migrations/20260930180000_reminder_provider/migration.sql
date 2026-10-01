ALTER TABLE "AppointmentPublicAccess" ADD COLUMN "actionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "actionWindowStartedAt" TIMESTAMP(3);

ALTER TABLE "AppointmentReminder" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "claimToken" TEXT,
ADD COLUMN "deliveryStatus" TEXT,
ADD COLUMN "dispatchStartedAt" TIMESTAMP(3),
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "provider" TEXT;

CREATE INDEX "AppointmentReminder_status_processingStartedAt_idx" ON "AppointmentReminder"("status", "processingStartedAt");
CREATE INDEX "AppointmentReminder_status_nextAttemptAt_idx" ON "AppointmentReminder"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "AppointmentReminder_provider_externalMessageId_key" ON "AppointmentReminder"("provider", "externalMessageId");
