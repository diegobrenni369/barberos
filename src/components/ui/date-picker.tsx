"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarIcon } from "lucide-react";
import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calendarDate, civilDate } from "@/lib/agenda-navigation";

// Civil YYYY-MM-DD values remain unchanged in FormData (no UTC conversion).
export function DatePicker({ name, defaultValue = "", required, label = "Fecha" }: {
  name: string; defaultValue?: string; required?: boolean; label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && civilDate(calendarDate(value)) === value;
  useEffect(() => {
    inputRef.current?.setCustomValidity(value && !valid ? "Ingresa una fecha válida." : "");
  }, [value, valid]);
  return <div className="relative min-w-0">
    <Input ref={inputRef} name={name} aria-label={label} value={value} required={required}
      placeholder="AAAA-MM-DD" pattern="\d{4}-\d{2}-\d{2}" className="pr-10 tabular-nums"
      onChange={event => { event.target.setCustomValidity(""); setValue(event.target.value); }}
      onBlur={event => event.target.setCustomValidity(value && !valid ? "Ingresa una fecha válida." : "")} />
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-0.5" aria-label={`Abrir calendario: ${label}`} />}><CalendarIcon /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50" collisionPadding={8}>
          <Popover.Popup className="w-fit max-w-[calc(100vw-1rem)] rounded-lg border bg-popover p-2 text-popover-foreground shadow-md outline-none">
            <Calendar mode="single" locale={es} weekStartsOn={1} selected={valid ? calendarDate(value) : undefined}
              defaultMonth={valid ? calendarDate(value) : undefined}
              onSelect={date => { if (date) { setValue(civilDate(date)); setOpen(false); } }} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>;
}
