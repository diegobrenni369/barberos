"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LoginForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(formData: FormData) {
    setError("");
    try {
    const result = await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirect: false });
    if (result?.error) setError("Correo o contraseña incorrectos");
    else router.push("/dashboard");
    } catch { toast.error("No se pudo iniciar sesión. Intenta nuevamente."); }
  }
  return <form action={submit} className="space-y-4">
    <div className="grid gap-2"><Label htmlFor="login-email">Correo</Label><Input id="login-email" name="email" type="email" autoComplete="username" required aria-describedby={error ? "login-error" : undefined} /></div>
    <div className="grid gap-2"><Label htmlFor="login-password">Contraseña</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required aria-describedby={error ? "login-error" : undefined} /></div>
    {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="w-full">Ingresar</Button>
  </form>;
}
