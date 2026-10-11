import { mobileBarberInput } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { blockInput, dayInput, createMobileBlock, loadMobileDay } from "@/lib/mobile-booking";
import { mobileBookingBody, mobileBookingRoute } from "@/lib/mobile-booking-http";
import { Prisma } from "@prisma/client";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileBookingRoute(request, async (barbershopId, access) => {
    const input = dayInput.parse(mobileBarberInput(access, Object.fromEntries(new URL(request.url).searchParams)));
    const day = await loadMobileDay(prisma, barbershopId, input);
    const reasons = await prisma.blockReason.findMany({ where: { barbershopId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return { reasons, intervals: day.intervals };
  });
}
export async function POST(request: Request) {
  return mobileBookingRoute(request, async (barbershopId, access) => {
    let result;
    try {
      const input = blockInput.parse(mobileBarberInput(access, await mobileBookingBody(request)));
      result = await createMobileBlock(barbershopId, input);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // Log categories/field names only: never tokens, notes, IDs or Prisma messages.
        console.warn("[mobile/blocks] Creation failed", {
          category: error instanceof z.ZodError ? "validation" : error instanceof Prisma.PrismaClientKnownRequestError ? "database" : "operation",
          fields: error instanceof z.ZodError ? error.issues.map(issue => ({ field: issue.path[0], code: issue.code })) : undefined,
          code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
        });
      }
      throw error;
    }
    revalidatePath("/agenda");
    return result;
  });
}
