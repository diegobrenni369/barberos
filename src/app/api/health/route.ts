import { prisma } from "@/lib/prisma";
import { logFailure } from "@/lib/safe-logging";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      await tx.$queryRaw`SELECT 1`;
    }, { maxWait: 2000, timeout: 3000 });
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logFailure("health_degraded");
    return Response.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
