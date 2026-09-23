"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(formData: FormData) {
    setError("");
    const result = await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirect: false });
    if (result?.error) setError("Correo o contraseña incorrectos");
    else router.push("/dashboard");
  }
  return <form action={submit} className="space-y-4">
    <label className="block text-sm font-medium">Correo<input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
    <label className="block text-sm font-medium">Contraseña<input name="password" type="password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <Button type="submit" className="w-full">Ingresar</Button>
  </form>;
}
