import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-xl font-semibold">Página no encontrada</h1><p>El recurso no existe o no está disponible para tu cuenta.</p><Link className="underline" href="/dashboard">Volver al inicio</Link></main>;
}
