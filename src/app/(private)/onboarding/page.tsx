import { OperationFeedback } from "@/components/operation-feedback";
import { createBarbershop } from "@/app/actions/barbershop";
import { BarbershopForm } from "@/components/barbershop-form";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">Crea tu barbería</h1><p className="mt-2 text-slate-600">Configura el espacio de trabajo para comenzar.</p><OperationFeedback error={error} /><BarbershopForm action={createBarbershop} submitLabel="Crear barbería" /></section>;
}
