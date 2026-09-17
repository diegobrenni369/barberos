import { updateBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";
import { requireRole } from "@/lib/auth";
import { MembershipRole } from "@prisma/client";
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) { const membership = await requireRole(MembershipRole.OWNER); const { error, success } = await searchParams; return <section className="max-w-xl rounded-xl bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">Configuración</h1><p className="mt-2 text-slate-600">Datos de tu barbería.</p>{error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}<BarbershopForm action={updateBarbershop} defaults={membership.barbershop} submitLabel="Guardar cambios" /></section>; }
