import { requireBarbershopAccess, requireAuth, getCurrentMembership } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth();
  const membership = await getCurrentMembership();
  if (!membership) return <section className="max-w-xl rounded-xl bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">BarberOS</h1><p className="mt-2 text-slate-600">Bienvenido, {user.name}</p><Link className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2 text-white" href="/onboarding">Crear mi barbería</Link></section>;
  const access = await requireBarbershopAccess();
  return <section className="max-w-xl rounded-xl bg-white p-6 shadow-sm"><p className="text-sm font-medium text-slate-500">BarberOS</p><h1 className="mt-2 text-2xl font-semibold">Bienvenido, {user.name}</h1><dl className="mt-6 space-y-3 border-t pt-5"><div><dt className="text-sm text-slate-500">Barbería</dt><dd className="font-medium">{access.barbershop.name}</dd></div><div><dt className="text-sm text-slate-500">Rol actual</dt><dd className="font-medium">{access.role}</dd></div></dl></section>;
}
