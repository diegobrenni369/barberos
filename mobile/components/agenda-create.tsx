import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { timeLabel } from "../lib/agenda";
import { Button, Card, Input, colors, styles } from "./ui";
import { Check } from "./chevron";
import { CompactSelect, DateControl, SearchIcon, SelectRow, PickerSurface, readableDate } from "./creation-controls";

export type CreateMode = "appointment" | "block" | "day";
type Customer = { id: string; name: string; phone: string | null };
type Service = { id: string; name: string; durationMinutes: number; price: string; currency: string };
type Props = { mode: CreateMode; barberId: string; barberName: string; initialDate: string; onClose: () => void; onCreated: (date: string) => void };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const money = (service: Service) => new Intl.NumberFormat("es-CL", { style: "currency", currency: service.currency }).format(Number(service.price));

function Choice({ title, detail, selected, onPress }: { title: string; detail?: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? colors.text : colors.border, backgroundColor: selected ? colors.text : colors.background }}><Text style={[styles.label, { color: selected ? "white" : colors.text, fontVariant: ["tabular-nums"] }]}>{title}</Text>{!!detail && <Text style={styles.muted}>{detail}</Text>}</Pressable>;
}

export function AgendaCreate(props: Props) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const setPending = (value: boolean) => { pending.current = value; setBusy(value); };
  const close = () => { if (!pending.current) props.onClose(); };
  return <Modal animationType="slide" onRequestClose={close}>
    <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ flex: 1, gap: 3 }}><Text style={[styles.subtitle, { fontSize: 20 }]}>{props.mode === "appointment" ? "Nueva cita" : props.mode === "day" ? "Bloquear día" : "Bloquear horario"}</Text><Text style={styles.muted}>{props.barberName}</Text></View><Button title="Cerrar" variant="ghost" disabled={busy} onPress={close} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { padding: 16 }]}>
        {props.mode === "appointment" ? <BookingForm {...props} setPending={setPending} /> : <BlockForm {...props} setPending={setPending} />}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

function BookingForm({ barberId, initialDate, onCreated, setPending }: Props & { setPending: (value: boolean) => void }) {
  const { get } = useAuth();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPicker, setCustomerPicker] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [services, setServices] = useState<Service[]>([]); const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(initialDate); const [time, setTime] = useState(""); const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timeout);
  }, [query]);
  useEffect(() => {
    if (step === 3 || (step === 2 && (!service || !validDate(date)))) return;
    let active = true; setLoading(true); setError("");
    const load = async () => {
      if (step === 0) { const result = await get<{ customers: Customer[] }>(`/api/mobile/customers?query=${encodeURIComponent(search)}`); if (active) setCustomers(result.customers); }
      if (step === 1) { const result = await get<{ services: Service[] }>(`/api/mobile/services?barberId=${encodeURIComponent(barberId)}`); if (active) setServices(result.services); }
      if (step === 2 && service) { const result = await get<{ slots: string[] }>(`/api/mobile/availability?barberId=${encodeURIComponent(barberId)}&serviceId=${encodeURIComponent(service.id)}&date=${date}`); if (active) { setSlots(result.slots); setTime(current => result.slots.includes(current) ? current : ""); } }
    };
    void load().catch(() => { if (active) { setError("No se pudieron cargar los datos. Intenta nuevamente."); if (step === 2) setSlots([]); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [step, search, date, service, barberId, get, reload]);
  const contactValid = name.trim().length >= 2 && /^[+\d\s().-]+$/.test(phone) && phone.replace(/\D/g, "").length >= 8 && (!email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  async function submit() {
    if (pending.current || !service) return;
    pending.current = true; setBusy(true); setPending(true); setError("");
    try {
      const result = await get<{ id: string; date: string }>("/api/mobile/appointments", { method: "POST", body: { barberId, serviceId: service.id, date, time, ...(isNew ? { customer: { name: name.trim(), phone, email: email.trim() } } : { customerId: customer?.id }) } });
      onCreated(result.date);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? "Ese horario ya no está disponible o el servicio no es elegible. Revisa fecha y hora." : "No se pudo crear la cita. Revisa tus datos y la agenda antes de reintentar.");
    } finally { pending.current = false; setBusy(false); setPending(false); }
  }
  return <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 14 }}>
    <Text style={styles.muted}>Paso {step + 1} de 4 · {["Cliente", "Servicio", "Fecha y hora", "Resumen"][step]}</Text>
    {step === 0 && <>
      {!isNew && <SelectRow label="Cliente" value={customer?.name ?? "Seleccionar cliente"} detail={customer ? customer.phone ?? "Sin teléfono" : undefined} onPress={() => setCustomerPicker(true)} />}
      {isNew && <Button title="Elegir cliente existente" variant="ghost" onPress={() => setCustomerPicker(true)} />}
      {customerPicker && <PickerSurface title="Cliente" onClose={() => setCustomerPicker(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ padding: 16 }}>
            <View><Input label="Buscar cliente" placeholder="Nombre o teléfono" value={query} onChangeText={setQuery} maxLength={100} returnKeyType="search" onSubmitEditing={() => { setSearch(query.trim()); setReload(value => value + 1); }} style={{ paddingRight: 48 }} /><Pressable accessibilityRole="button" accessibilityLabel="Buscar cliente" onPress={() => { setSearch(query.trim()); setReload(value => value + 1); }} style={{ position: "absolute", right: 2, bottom: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SearchIcon /></Pressable></View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {loading && <ActivityIndicator accessibilityLabel="Buscando clientes" />}
            {!loading && !error && customers.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: customer?.id === item.id }} onPress={() => { setCustomer(item); setIsNew(false); setCustomerPicker(false); }} style={{ minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: customer?.id === item.id ? colors.soft : colors.background, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1, gap: 3 }}><Text style={styles.label}>{item.name}</Text><Text style={[styles.muted, { fontSize: 12 }]}>{item.phone ?? "Sin teléfono"}</Text></View>{customer?.id === item.id && <Check />}</Pressable>)}
            {!loading && !error && !customers.length && <Text style={styles.muted}>No se encontraron clientes.</Text>}
            {!!error && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Reintentar" secondary onPress={() => setReload(value => value + 1)} /></View>}
          </ScrollView>
          <View style={{ padding: 16, borderTopWidth: 1, borderColor: colors.border }}><Button title="Crear cliente nuevo" secondary onPress={() => { setIsNew(true); setCustomer(null); setCustomerPicker(false); }} /></View>
        </KeyboardAvoidingView>
      </PickerSurface>}
      {isNew && <><Input label="Nombre" value={name} onChangeText={setName} maxLength={100} autoComplete="name" /><Input label="Teléfono" value={phone} onChangeText={setPhone} maxLength={30} keyboardType="phone-pad" autoComplete="tel" /><Input label="Email (opcional)" value={email} onChangeText={setEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Text style={styles.muted}>Si el teléfono ya existe, reutilizaremos ese cliente.</Text></>}
      <Button title="Continuar" disabled={isNew ? !contactValid : !customer} onPress={() => setStep(1)} />
    </>}
    {step === 1 && <><CompactSelect label="Servicio" value={service?.id ?? ""} disabled={loading} options={services.map(item => ({ id: item.id, title: item.name, detail: `${item.durationMinutes} min · ${money(item)}` }))} onChange={id => { setService(services.find(item => item.id === id) ?? null); setTime(""); }} />{!loading && !services.length && <Text style={styles.muted}>Este profesional no tiene servicios activos asignados.</Text>}<Button title="Continuar" disabled={!service || loading || !!error} onPress={() => setStep(2)} /></>}
    {step === 2 && <>
      <DateControl date={date} onChange={value => { setDate(value); setTime(""); setSlots([]); }} />
      {!loading && validDate(date) && !slots.length && <Text style={styles.muted}>No hay horarios disponibles para este día.</Text>}
      {!loading && validDate(date) && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{slots.map(slot => <Choice key={slot} title={slot} selected={slot === time} onPress={() => setTime(slot)} />)}</View>}
      <Button title="Revisar cita" disabled={!time || !slots.includes(time) || !validDate(date) || loading || !!error} onPress={() => setStep(3)} />
    </>}
    {step === 3 && service && <><Card><Text style={styles.subtitle}>{isNew ? name : customer?.name}</Text><Text style={styles.label}>{service.name}</Text><Text style={styles.muted}>{readableDate(date)} · {time} · {service.durationMinutes} min</Text><Text style={styles.subtitle}>{money(service)}</Text></Card><Button title="Crear cita" loading={busy} onPress={() => void submit()} /></>}
    {loading && <ActivityIndicator accessibilityLabel="Cargando" />}
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{step < 3 && <Button title="Reintentar" secondary onPress={() => setReload(value => value + 1)} />}</>}
    {step > 0 && <Button title="Atrás" variant="ghost" disabled={busy} onPress={() => { setError(""); setStep(value => value - 1); }} />}
  </View>;
}

function BlockForm({ mode, barberId, initialDate, onCreated, setPending }: Props & { setPending: (value: boolean) => void }) {
  const { get } = useAuth();
  const [date, setDate] = useState(initialDate); const [startTime, setStartTime] = useState("09:00"); const [endTime, setEndTime] = useState("10:00");
  const [reasonId, setReasonId] = useState(""); const [note, setNote] = useState("");
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);
  const [data, setData] = useState<{ reasons: { id: string; name: string }[]; intervals: { startMinute: number; endMinute: number }[] } | null>(null);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [reload, setReload] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!validDate(date)) return;
    let active = true; setLoading(true); setData(null); setError("");
    void get<NonNullable<typeof data>>(`/api/mobile/blocks?barberId=${encodeURIComponent(barberId)}&date=${date}`).then(result => { if (active) setData(result); }).catch(() => { if (active) setError("No se pudieron cargar los motivos y horarios."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, barberId, get, reload]);
  const allDay = mode === "day";
  const hoursValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) && startTime < endTime;
  const halfHours = Array.from({ length: 48 }, (_, index) => index * 30);
  const startMinute = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const startSlots = halfHours.filter(minute => data?.intervals.some(interval => minute >= interval.startMinute && minute + 30 <= interval.endMinute)).map(timeLabel);
  const endSlots = startSlots.includes(startTime) ? halfHours.filter(minute => minute > startMinute && data?.intervals.some(interval => startMinute >= interval.startMinute && startMinute < interval.endMinute && minute <= interval.endMinute)).map(timeLabel) : [];
  const selectedHoursAvailable = startSlots.includes(startTime) && endSlots.includes(endTime);
  async function submit() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setPending(true); setError("");
    try {
      const result = await get<{ id: string; date: string }>("/api/mobile/blocks", { method: "POST", body: { barberId, date, allDay, reasonId, note, ...(!allDay ? { startTime, endTime } : {}) } });
      onCreated(result.date);
    } catch (failure) { setError(failure instanceof ApiError && failure.status === 409 ? "No se puede bloquear: hay reservas activas o cambió la jornada. Revisa la agenda." : "No se pudo guardar el bloqueo. Revisa los datos y la agenda antes de reintentar."); }
    finally { pending.current = false; setBusy(false); setPending(false); }
  }
  return <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 14 }}>
    <DateControl date={date} onChange={setDate} />
    {!allDay && <>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><SelectRow label="Inicio" value={startSlots.includes(startTime) ? startTime : "Seleccionar"} disabled={loading || !startSlots.length} onPress={() => setTimePicker("start")} /></View>
        <View style={{ flex: 1 }}><SelectRow label="Fin" value={endSlots.includes(endTime) ? endTime : "Seleccionar"} disabled={loading || !endSlots.length} onPress={() => setTimePicker("end")} /></View>
      </View>
      {!loading && data && !startSlots.length && <Text style={styles.muted}>No hay horarios disponibles para bloquear este día.</Text>}
      {timePicker && <PickerSurface title={timePicker === "start" ? "Inicio" : "Fin"} onClose={() => setTimePicker(null)}>
        <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(timePicker === "start" ? startSlots : endSlots).map(slot => <Choice key={slot} title={slot} selected={slot === (timePicker === "start" ? startTime : endTime)} onPress={() => { if (timePicker === "start") setStartTime(slot); else setEndTime(slot); setTimePicker(null); }} />)}
        </ScrollView>
      </PickerSurface>}
    </>}
    {allDay && data && <Text style={styles.muted}>{data.intervals.length ? `Jornada: ${timeLabel(Math.min(...data.intervals.map(row => row.startMinute)))}–${timeLabel(Math.max(...data.intervals.map(row => row.endMinute)))}` : "El profesional no trabaja ese día. No es necesario bloquearlo."}</Text>}
    {loading && <ActivityIndicator />}
    <CompactSelect label="Motivo" value={reasonId} disabled={loading} options={data?.reasons.map(reason => ({ id: reason.id, title: reason.name })) ?? []} onChange={setReasonId} />
    {data && !data.reasons.length && <Text style={styles.muted}>No hay motivos activos. Configúralos desde la web.</Text>}
    <Input label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={500} multiline />
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Actualizar datos" secondary disabled={busy} onPress={() => setReload(value => value + 1)} /></>}
    <Button title={allDay ? "Bloquear día" : "Guardar bloqueo"} loading={busy} disabled={loading || !validDate(date) || !data?.reasons.some(reason => reason.id === reasonId) || (allDay ? !data?.intervals.length : !hoursValid || !selectedHoursAvailable)} onPress={() => void submit()} />
  </View>;
}
