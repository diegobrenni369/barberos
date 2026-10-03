"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const states = { all: "Todos", active: "Activos", inactive: "Inactivos" };

export function ListFilters({ q, status, placeholder }: { q: string; status: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const selected = status === "active" || status === "inactive" ? status : "all";
  function navigate(state: string) {
    const params = new URLSearchParams();
    const query = search.current?.value.trim();
    if (query) params.set("q", query);
    if (state !== "all") params.set("status", state);
    startTransition(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  }
  return <form role="search" aria-busy={pending} onSubmit={event => { event.preventDefault(); navigate(selected); }} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="relative w-full sm:max-w-sm">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input key={q} ref={search} name="q" type="search" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="h-8 pl-9" />
    </div>
    <Select value={selected} onValueChange={value => { if (value) navigate(value); }} disabled={pending}>
      <SelectTrigger aria-label="Estado" className="h-8 w-auto min-w-40 shrink-0 self-end"><SelectValue>Estado: {states[selected]}</SelectValue></SelectTrigger>
      <SelectContent>{Object.entries(states).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
    </Select>
  </form>;
}
