export const metadata = { title: "Reserva cancelada | BarberOS", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function CancelledPage() {
  return <main lang="es" className="min-h-dvh bg-muted/20 px-4 py-8 sm:py-12"><div className="mx-auto w-full max-w-lg space-y-6">
    <h1 className="text-3xl font-semibold tracking-tight">Reserva cancelada</h1>
    <section className="rounded-xl border border-border bg-background p-5"><p role="status">Tu reserva fue cancelada. El horario quedó disponible.</p></section>
    <p className="text-center text-xs text-muted-foreground">Reservas con BarberOS</p>
  </div></main>;
}
