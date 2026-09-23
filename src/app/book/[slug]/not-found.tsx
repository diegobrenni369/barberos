import { Card, CardContent } from "@/components/ui/card";
export default function NotFound() {
  return <main lang="es" className="mx-auto w-full max-w-lg px-4 py-12"><Card><CardContent className="space-y-2"><h1 className="text-xl font-semibold">Barbería no encontrada</h1><p className="text-sm text-muted-foreground">Revisa el enlace de reserva e intenta nuevamente.</p></CardContent></Card></main>;
}
