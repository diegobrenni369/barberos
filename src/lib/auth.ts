import { MembershipRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validateCredentials } from "@/lib/credentials";
import { allowPublicRequest } from "@/lib/rate-limit";
import { logFailure } from "@/lib/safe-logging";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  logger: { error() { logFailure("auth_failed"); }, warn() {}, debug() {} },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email y contraseña",
    credentials: { email: { label: "Correo", type: "email" }, password: { label: "Contraseña", type: "password" } },
    async authorize(credentials, request) {
      const requestHeaders = new Headers();
      for (const [key, value] of Object.entries(request.headers || {})) if (typeof value === "string") requestHeaders.set(key, value);
      if (!await allowPublicRequest(prisma, requestHeaders, "login")) return null;
      return validateCredentials(credentials);
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
