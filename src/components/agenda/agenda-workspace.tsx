"use client";

import { useId, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { PanelRightClose, PanelRightOpen, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { AppointmentQuickView } from "./appointment-quick-view";
import { AgendaView } from "@/components/agenda/agenda-view";
import { ClosedAgenda } from "@/components/agenda/closed-agenda";
import { AgendaPanel } from "@/components/agenda/agenda-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

export function AgendaWorkspace({ isClosed, ...props }: ComponentProps<typeof AgendaView> & { isClosed: boolean }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detail, setDetail] = useState<{ id: string; date: string; onEdit: () => void } | null>(null);
  const appointment = detail?.date === props.date ? props.appointments.find(item => item.id === detail.id) : undefined;
  const showPanel = panelOpen || Boolean(appointment);
  const closeDetail = () => setDetail(null);
  const id = useId();
  const params = useSearchParams();
  const filter = params.get("barbers");
  const selected = filter === null ? props.barbers : props.barbers.filter(barber => filter.split(",").includes(barber.id));
  const panel = <AgendaPanel key={props.date} date={props.date} today={props.today} barbers={props.barbers} selectedIds={selected.map(barber => barber.id)} />;
  const content = <>
    <div hidden={Boolean(appointment)}>{panel}</div>
    {appointment && <AppointmentQuickView appointment={appointment} barberName={props.barbers.find(barber => barber.id === appointment.barberId)?.name ?? "Barbero"} onClose={closeDetail} onEdit={() => { detail?.onEdit(); closeDetail(); setMobileOpen(false); }} />}
  </>;
  const back = appointment && <Button variant="ghost" size="icon" aria-label="Volver a calendario y filtros" onClick={closeDetail}><ArrowLeft /></Button>;
  const controls = <>
    <Button variant="outline" size="icon" className="hidden md:inline-flex" aria-label={showPanel ? "Ocultar panel de agenda" : "Mostrar panel de agenda"} title={showPanel ? "Ocultar panel de agenda" : "Mostrar panel de agenda"} aria-expanded={showPanel} aria-controls={id} onClick={() => { closeDetail(); setPanelOpen(!showPanel); }}>
      {showPanel ? <PanelRightClose /> : <PanelRightOpen />}
    </Button>
    <Sheet open={mobileOpen} onOpenChange={open => { setMobileOpen(open); if (!open) closeDetail(); }}>
      <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Calendario y filtros de agenda" />}><SlidersHorizontal /></SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <SheetHeader><SheetTitle className="flex items-center gap-2">{back}{appointment ? "Reserva" : "Agenda"}</SheetTitle><SheetDescription>{appointment ? "Detalle y acciones de la reserva" : "Calendario y filtros"}</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">{content}</div>
      </SheetContent>
    </Sheet>
  </>;

  return (
    <div data-agenda-workspace className={`min-w-0 ${showPanel ? "md:pr-[280px]" : ""}`}>
      <div className="min-w-0 flex-1">
        {isClosed
          ? <ClosedAgenda date={props.date} today={props.today} panelControls={controls} />
          : <AgendaView {...props} suppressAppointmentHover={Boolean(appointment)} barbers={selected} allBarbers={props.barbers} panelControls={controls} onAppointmentSelect={(item, onEdit) => { setDetail({ id: item.id, date: props.date, onEdit }); if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen(true); }} />}
      </div>
      {showPanel && <aside id={id} aria-label="Panel de agenda" className="fixed inset-y-0 right-0 top-14 z-30 hidden w-[280px] overflow-y-auto border-l bg-sidebar text-sidebar-foreground md:block">
        <div className="flex items-center gap-2 border-b px-5 py-4 text-sm font-medium">{back}{appointment ? "Reserva" : "Calendario y filtros"}</div>
        {content}
      </aside>}
    </div>
  );
}
