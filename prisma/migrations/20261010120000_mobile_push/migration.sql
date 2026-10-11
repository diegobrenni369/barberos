CREATE TABLE "MobilePushToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "MobilePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MobilePushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobilePushToken_token_key" ON "MobilePushToken"("token");
CREATE INDEX "MobilePushToken_userId_revokedAt_idx" ON "MobilePushToken"("userId", "revokedAt");
CREATE INDEX "MobilePushToken_sessionId_idx" ON "MobilePushToken"("sessionId");
CREATE TABLE "MobilePushDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "receiptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedAt" TIMESTAMP(3),
  CONSTRAINT "MobilePushDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobilePushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobilePushDelivery_deviceId_eventKey_key" ON "MobilePushDelivery"("deviceId", "eventKey");
CREATE INDEX "MobilePushDelivery_checkedAt_createdAt_idx" ON "MobilePushDelivery"("checkedAt", "createdAt");
