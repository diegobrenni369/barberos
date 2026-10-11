import { BrandLogo } from "@/components/brand-logo";
import { OperationFeedback } from "@/components/operation-feedback";
import { createBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="mx-auto max-w-xl rounded-xl bg-card p-6 shadow-sm"><BrandLogo className="mb-4" /><h1 className="text-2xl font-semibold">Crea tu barbería</h1><p className="mt-2 text-muted-foreground">Configura el espacio de trabajo para comenzar.</p><OperationFeedback error={error} /><BarbershopForm action={createBarbershop} submitLabel="Crear barbería" /></section>;
}
