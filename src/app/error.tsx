"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section role="alert" className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-xl font-semibold">No pudimos cargar esta página</h1><p className="text-sm text-muted-foreground">Intenta nuevamente. Si estabas guardando un cambio, comprueba su estado antes de repetirlo.</p><Button onClick={retry}>Intentar nuevamente</Button></section>;
}
