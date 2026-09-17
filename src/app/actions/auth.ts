"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/register?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) redirect("/register?error=Ya existe una cuenta con este correo");
  await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  redirect(`/login?registered=${encodeURIComponent("Cuenta creada. Inicia sesión para continuar.")}`);
}
