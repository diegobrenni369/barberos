"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { respondToAppointment } from "@/lib/appointment-reminders";
import { allowAppointmentAction } from "@/lib/notifications/public-rate-limit";

export async function appointmentResponse(slug: string, token: string, action: "confirm" | "cancel") {
  if (typeof slug !== "string" || typeof token !== "string" || !["confirm", "cancel"].includes(action)) return { ok: false };
  let ok: boolean;
  try {
    if (!await allowAppointmentAction(prisma, token)) return { ok: false };
    ok = await respondToAppointment(prisma, slug, token, action);
  } catch {
    return { ok: false };
  }
  if (ok) {
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    revalidatePath("/customers");
    // A revoked link cannot render appointment data after the action refresh.
    // Redirect to a non-sensitive receipt instead of replacing success with "expired".
    if (action === "cancel") redirect(`/book/${encodeURIComponent(slug)}/manage/cancelled`);
  }
  return { ok };
}
