import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

const upcoming = ["Agenda", "Clientes", "Barberos", "Servicios", "Caja"];

export function PrivateSidebar() {
  return <aside className="flex w-full shrink-0 flex-col border-b bg-white p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
    <Link href="/dashboard" className="mb-5 text-xl font-bold tracking-tight">BarberOS</Link>
    <nav className="flex flex-wrap gap-1 md:flex-col">
      <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100">Dashboard</Link>
      {upcoming.map((item) => <span key={item} className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-400" title="Próximamente">{item} <small>Próximamente</small></span>)}
      <Link href="/settings" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100">Configuración</Link>
    </nav>
    <div className="mt-4 md:mt-auto"><LogoutButton /></div>
  </aside>;
}
