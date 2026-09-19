import { updateBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";
import { requireRole } from "@/lib/auth";
import { MembershipRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) { const membership = await requireRole(MembershipRole.OWNER); const { error, success } = await searchParams; return <section className="space-y-6"><PageHeader title="Configuración" description="Administra los datos generales de tu barbería." />{error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}<Card className="max-w-3xl"><CardHeader><CardTitle>Información de la barbería</CardTitle><CardDescription>Estos datos identifican tu espacio de trabajo.</CardDescription></CardHeader><CardContent><BarbershopForm action={updateBarbershop} defaults={membership.barbershop} submitLabel="Guardar cambios" /></CardContent></Card></section>; }
