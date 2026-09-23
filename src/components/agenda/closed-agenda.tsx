"use client";

import { AgendaToolbar } from "@/components/agenda/agenda-toolbar";
import type { ReactNode } from "react";

export function ClosedAgenda({ date, dateLabel, today, panelControls }: { date: string; dateLabel: string; today: string; panelControls?: ReactNode }) { return <div className="space-y-4"><AgendaToolbar date={date} dateLabel={dateLabel} today={today} panelControls={panelControls} /><div className="rounded-xl border bg-card p-10 text-center"><p className="font-medium">Barbería cerrada</p><p className="mt-1 text-sm text-muted-foreground">La barbería no tiene horario de atención configurado para este día.</p></div></div>; }
