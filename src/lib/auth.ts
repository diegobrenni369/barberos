import { MembershipRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email y contraseña",
    credentials: { email: { label: "Correo", type: "email" }, password: { label: "Contraseña", type: "password" } },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  })],
  callbacks: {
    jwt: ({ token, user }) => { if (user) token.id = user.id; return token; },
    session: ({ session, token }) => {
      if (session.user && token.id) session.user.id = token.id;
      return session;
    },
  },
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentMembership() {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.barbershopMembership.findFirst({
    where: { userId: user.id },
    include: { barbershop: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireBarbershopAccess() {
  await requireAuth();
  const membership = await getCurrentMembership();
  if (!membership || !membership.barbershop.isActive) redirect("/onboarding");
  return membership;
}

export async function requireRole(...roles: MembershipRole[]) {
  const membership = await requireBarbershopAccess();
  if (!roles.includes(membership.role)) redirect("/dashboard");
  return membership;
}
