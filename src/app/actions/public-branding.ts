"use server";

import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { instagramLink } from "@/lib/public-branding";

export async function savePublicBranding(form: FormData) {
  const member = await requireRole(MembershipRole.OWNER);
  const parsed = z.object({ description: z.string().trim().max(600), instagram: z.string().trim().max(300) }).safeParse({ description: form.get("description"), instagram: form.get("instagram") });
  if (!parsed.success) redirect("/settings?error=Revisa+la+descripción+(máximo+600+caracteres)+e+Instagram.");
  const instagram = instagramLink(parsed.data.instagram);
  if (parsed.data.instagram && !instagram) redirect("/settings?error=Usa+una+URL+HTTPS+válida+de+Instagram.");
  await prisma.barbershop.update({ where: { id: member.barbershopId }, data: { publicDescription: parsed.data.description || null, instagramUrl: instagram } });
  revalidatePath("/settings"); revalidatePath(`/book/${member.barbershop.slug}`);
  redirect("/settings?success=Sitio+público+guardado");
}
