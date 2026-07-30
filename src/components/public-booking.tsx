"use client";

import { bookPublicAppointmentAction } from "@/app/n/[token]/actions";
import { Check, DynamicIcon, Loader2, MapPin } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Reserva pública de turno. La abre el cliente desde el link del negocio, sin
// cuenta y casi siempre desde el celular: por eso es elegir día → horario →
// nombre y teléfono, y nada más.

export type PublicBookingProps = {
  token: string;
  businessName: string;
  branchId: string;
  branchAddress: string | null;
  note: string | null;
  icon: string;
  staffLabel: string;
  staffs: { id: string; name: string }[];
  services: { id: string; name: string; price: number }[];
  // "YYYY-MM-DD" calculados en el servidor: la fecha del navegador puede estar corrida.
  days: string[];
  selectedDay: string;
  selectedStaffId: string | null;
  // Horarios libres en ISO.
  slots: string[];
  durationMinutes: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

const input =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white";

export function PublicBooking(props: PublicBookingProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slot, setSlot] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pickDay(day: string) {
    setSlot(null);
    const params = new URLSearchParams({ dia: day });
    if (props.selectedStaffId) params.set("staff", props.selectedStaffId);
    router.push(`/n/${props.token}?${params.toString()}`, { scroll: false });
  }

  function pickStaff(staffId: string) {
    setSlot(null);
    const params = new URLSearchParams({ dia: props.selectedDay });
    if (staffId) params.set("staff", staffId);
    router.push(`/n/${props.token}?${params.toString()}`, { scroll: false });
  }

  function submit() {
    if (!slot) return;
    setError(null);

    startTransition(async () => {
      const result = await bookPublicAppointmentAction({
        token: props.token,
        branchId: props.branchId,
        staffId: props.selectedStaffId,
        productId: serviceId || null,
        startsAt: slot,
        durationMinutes: props.durationMinutes,
        customerName: name,
        customerPhone: phone,
      });

      if (result.ok) {
        setDone(result.timeLabel);
      } else {
        setError(result.error);
        // El horario pudo haberse ocupado mientras completaba: refrescamos.
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-950/5">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="size-10" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">¡Turno reservado!</h1>
          <p className="mt-2 text-sm font-semibold capitalize text-slate-500">{done}</p>
          <p className="mt-4 text-sm text-slate-500">
            Te esperamos en <span className="font-black text-slate-950">{props.businessName}</span>.
          </p>
        </div>
      </main>
    );
  }

  const canBook = Boolean(slot) && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 6;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-950/5">
        <header className="bg-slate-950 px-6 py-7 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
              <DynamicIcon className="size-6" name={props.icon} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight">{props.businessName}</h1>
              <p className="text-sm text-white/60">Reservá tu turno</p>
            </div>
          </div>
          {props.branchAddress ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
              <MapPin className="size-3.5" />
              {props.branchAddress}
            </p>
          ) : null}
          {props.note ? <p className="mt-2 text-xs text-white/60">{props.note}</p> : null}
        </header>

        <div className="space-y-5 px-6 py-6">
          {props.staffs.length > 1 ? (
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                ¿Con quién? <span className="font-bold normal-case text-slate-400">(opcional)</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                    props.selectedStaffId === null ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={() => pickStaff("")}
                  type="button"
                >
                  Cualquiera
                </button>
                {props.staffs.map((staff) => (
                  <button
                    className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                      props.selectedStaffId === staff.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                    key={staff.id}
                    onClick={() => pickStaff(staff.id)}
                    type="button"
                  >
                    {staff.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿Qué día?</p>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {props.days.map((day) => {
                const date = new Date(`${day}T12:00:00`);
                const selected = day === props.selectedDay;

                return (
                  <button
                    className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold capitalize transition ${
                      selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                    key={day}
                    onClick={() => pickDay(day)}
                    type="button"
                  >
                    {dayFormatter.format(date)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿A qué hora?</p>
            {props.slots.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                No quedan horarios para este día. Probá con otro.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {props.slots.map((iso) => (
                  <button
                    className={`rounded-xl py-2.5 text-sm font-black transition ${
                      slot === iso ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                    key={iso}
                    onClick={() => setSlot(iso)}
                    type="button"
                  >
                    {timeFormatter.format(new Date(iso))}
                  </button>
                ))}
              </div>
            )}
          </div>

          {props.services.length > 0 ? (
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              ¿Qué te vas a hacer? <span className="font-bold normal-case text-slate-400">(opcional)</span>
              <select className={input} onChange={(event) => setServiceId(event.target.value)} value={serviceId}>
                <option value="">Lo vemos ahí</option>
                {props.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {money(service.price)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Tu nombre
              <input
                className={input}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Juan"
                value={name}
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Tu teléfono
              <input
                className={input}
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="11 5555-5555"
                value={phone}
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
            disabled={!canBook || isPending}
            onClick={submit}
            type="button"
          >
            {isPending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            Reservar turno
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Turnos gestionados con Bills</p>
    </main>
  );
}
