"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, paymentMethods, type SaleDetailsData } from "@/lib/cash";
import { SaleDetails } from "./sale-details";

export function SalesTable({ sales, timezone }: { sales: SaleDetailsData[]; timezone: string }) {
  const [selected, setSelected] = useState<SaleDetailsData | null>(null);
  return <><div className="overflow-hidden rounded-xl border">{sales.length === 0 ? <div className="flex flex-col items-center gap-2 px-6 py-14 text-center"><Receipt className="mb-2 size-7 text-muted-foreground" /><h2 className="font-medium">Aún no hay ventas en esta fecha</h2><p className="text-sm text-muted-foreground">Los cobros registrados desde Agenda aparecerán aquí.</p></div> : <Table><TableHeader><TableRow>{["Hora", "Cliente", "Barbero", "Servicio", "Total", "Método", ""].map((label, index) => <TableHead key={index}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{sales.map(sale => <TableRow key={sale.id} onClick={() => setSelected(sale)} className="cursor-pointer"><TableCell className="tabular-nums">{new Intl.DateTimeFormat("es-CL", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(sale.createdAt))}</TableCell><TableCell className="font-medium">{sale.customerName}</TableCell><TableCell>{sale.barberName}</TableCell><TableCell>{sale.items.map(item => item.description).join(", ")}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{formatMoney(sale.total, sale.currency)}</TableCell><TableCell>{sale.payments.map(payment => paymentMethods[payment.method]).join(", ")}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => setSelected(sale)} aria-label={`Ver venta de ${sale.customerName}`}>Ver detalle</Button></TableCell></TableRow>)}</TableBody></Table>}</div>{selected && <SaleDetails sale={selected} timezone={timezone} onClose={() => setSelected(null)} />}</>;
}
