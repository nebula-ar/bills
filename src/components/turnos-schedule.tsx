"use client";

// Turnos migrado a Syncfusion EJ2 Scheduler (NEBU-47). Reemplaza el listado
// del día y el formulario de alta por el Schedule de EJ2:
//
// - Vistas día / semana / agenda, con los textos en español (locale global).
// - Drag & drop para mover turnos y resize para estirarlos; cada cambio se
//   persiste con la misma lógica de negocio de siempre (choque de horarios
//   por empleado incluido).
// - Doble clic en un horario (o el botón "Nuevo turno") abre el alta; clic en
//   un turno abre la ficha con edición, estado (Confirmar / No vino), Cobrar
//   y Borrar.
// - El DatePicker del toolbar del Scheduler (y el botón Hoy) permite saltar
//   de fecha rápido; la URL ?day= se mantiene en sincronía.
//
// Los datos viajan como turnos planos (fechas ISO); cuando el Scheduler sale
// del rango ya cargado, pide más con getRangeAction y los mergea.

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Agenda, Day, DragAndDrop, Inject, Resize, ScheduleComponent, Week } from "@syncfusion/ej2-react-schedule";
import type {
  ActionEventArgs,
  CellClickEventArgs,
  EventClickArgs,
  NavigatingEventArgs,
  PopupOpenEventArgs,
} from "@syncfusion/ej2-schedule";
import { DialogComponent } from "@syncfusion/ej2-react-popups";

import { Badge, Field, inputClass } from "@/components/manager-ui";
import { StatTiles } from "@/components/stat-tiles";
import { SyncSelect } from "@/components/sync-select";
import type { AppointmentStatusValue, TurnoEventData, TurnoReferenceData } from "@/app/turnos/types";
import { STATUS_LABELS, STATUS_TONES } from "@/app/turnos/types";

type ActionResult = { ok: boolean; message: string; id?: string };
type RangeResult = { ok: boolean; message?: string; appointments?: TurnoEventData[] };

type TurnosScheduleProps = {
  initialEvents: TurnoEventData[];
  /** Fecha inicial en YYYY-MM-DD (viene del ?day= de la URL). */
  initialDay: string;
  references: TurnoReferenceData;
  createAction: (formData: FormData) => Promise<ActionResult>;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  moveAction: (formData: FormData) => Promise<ActionResult>;
  setStatusAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
  getRangeAction: (fromISO: string, toISO: string) => Promise<RangeResult>;
};

// El registro tal como lo consume el Schedule de EJ2: campos mapeados
// (Id/Subject/StartTime/EndTime/CssClass) + los datos del negocio que usa el
// editor, que EJ2 preserva en cada registro al moverlo.
type ScheduleEvent = {
  Id: string;
  Subject: string;
  StartTime: Date;
  EndTime: Date;
  CssClass: string;
  durationMinutes: number;
  status: AppointmentStatusValue;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  saleId: string | null;
  customerId: string | null;
  staffId: string | null;
  staffName: string | null;
  productId: string | null;
  productName: string | null;
  branchId: string;
};

const DURATIONS = [15, 30, 45, 60, 90];

// Los botones de manager-ui son solo para forms (type=submit, sin disabled):
// acá se necesitan variantes con onClick para los diálogos del Scheduler.
function ActionButton({
  children,
  className = "",
  disabled,
  onClick,
  submit = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  submit?: boolean;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type={submit ? "submit" : "button"}
    >
      {children}
    </button>
  );
}

function GhostActionButton({
  children,
  className = "",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

// La agenda se muestra entre las 7 y las 23: es el horario realista de un
// negocio de turnos; los turnos fuera de ese rango no se pintan.
const START_HOUR = "07:00";
const END_HOUR = "23:00";

const VIEWS = [
  { option: "Day" as const, label: "Día" },
  { option: "Week" as const, label: "Semana" },
  { option: "Agenda" as const, label: "Agenda" },
];

const TIMESCALE = { enable: true, interval: 60, slotCount: 2 };

// Ventana inicial que pide el servidor alrededor de la fecha elegida. El
// cliente estira el rango de a ±15 días cuando navega más allá.
const MARGIN_DAYS = 15;

function eventTemplate(props: ScheduleEvent) {
  return (
    <div className="flex h-full flex-col justify-center gap-0.5 overflow-hidden px-1.5 py-1">
      <p className="truncate text-[0.72rem] font-black leading-tight">{props.customerName ?? "Sin nombre"}</p>
      <p className="truncate text-[0.62rem] font-bold leading-tight opacity-85">
        {props.productName ?? "Sin servicio"}
        {props.staffName ? ` · ${props.staffName}` : ""}
      </p>
    </div>
  );
}

export function TurnosSchedule({
  initialEvents,
  initialDay,
  references,
  createAction,
  updateAction,
  moveAction,
  setStatusAction,
  deleteAction,
  getRangeAction,
}: TurnosScheduleProps) {
  const scheduleRef = useRef<ScheduleComponent>(null);

  const [events, setEvents] = useState<ScheduleEvent[]>(() => initialEvents.map(toScheduleEvent));
  const [currentDate, setCurrentDate] = useState<Date>(() => parseDay(initialDay));
  const currentDateRef = useRef<Date>(parseDay(initialDay));

  const [createStart, setCreateStart] = useState<Date | null>(null);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [deleting, setDeleting] = useState<ScheduleEvent | null>(null);
  const [busy, setBusy] = useState(false);

  // Rango ya cargado del servidor (lo que sembró page.tsx y lo que vamos
  // sumando al navegar). Sirve para no volver a pedir lo mismo. Arranca
  // alrededor de la fecha inicial (la misma que siembra el servidor).
  const loadedRef = useRef({
    from: startOfDay(addDays(parseDay(initialDay), -MARGIN_DAYS)),
    to: endOfDay(addDays(parseDay(initialDay), MARGIN_DAYS)),
  });

  // Para no abrir la ficha con el clic que cierra un drag.
  const lastMutationRef = useRef(0);

  const eventSettings = useMemo(
    () => ({
      dataSource: events,
      fields: { id: "Id", subject: "Subject", startTime: "StartTime", endTime: "EndTime" },
      template: eventTemplate,
    }),
    [events],
  );

  const dayEvents = useMemo(
    () => events.filter((event) => isSameDay(event.StartTime, currentDate)),
    [events, currentDate],
  );
  const pending = dayEvents.filter(
    (event) => event.status === "SCHEDULED" || event.status === "CONFIRMED",
  ).length;
  const done = dayEvents.filter((event) => event.status === "DONE").length;

  function findEvent(id: string) {
    return events.find((event) => event.Id === id) ?? null;
  }

  // ── Carga de rango ────────────────────────────────────────────────────────

  const ensureRange = useCallback(
    async (date: Date) => {
      const wantFrom = startOfDay(addDays(date, -MARGIN_DAYS));
      const wantTo = endOfDay(addDays(date, MARGIN_DAYS));
      const current = loadedRef.current;

      if (wantFrom >= current.from && wantTo <= current.to) return;

      const from = wantFrom < current.from ? wantFrom : current.from;
      const to = wantTo > current.to ? wantTo : current.to;

      const result = await getRangeAction(from.toISOString(), to.toISOString());
      if (!result.ok || !result.appointments) return;

      loadedRef.current = { from, to };
      setEvents((prev) => {
        const merged = new Map(prev.map((event) => [event.Id, event]));
        for (const row of result.appointments ?? []) merged.set(row.id, toScheduleEvent(row));
        return [...merged.values()].sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime());
      });
    },
    [getRangeAction],
  );

  // Refresca el estado desde el servidor: fuente de verdad después de crear,
  // editar, borrar, cambiar estado o cuando un movimiento fue rechazado.
  const refreshFromServer = useCallback(async () => {
    const { from, to } = loadedRef.current;
    const result = await getRangeAction(from.toISOString(), to.toISOString());
    if (result.ok && result.appointments) {
      setEvents(result.appointments.map(toScheduleEvent));
    }
  }, [getRangeAction]);

  // ── Navegación ───────────────────────────────────────────────────────────

  function handleActionBegin(args: ActionEventArgs) {
    // Navegación interna (flechas del toolbar, DatePicker, Hoy): sincroniza
    // el estado y la URL. El guard evita el loop del prop seleccionado.
    if (args.requestType === "navigating") {
      const date = (args as unknown as NavigatingEventArgs).currentDate;
      if (date && date.getTime() !== currentDateRef.current.getTime()) {
        currentDateRef.current = date;
        setCurrentDate(date);
        window.history.replaceState(null, "", `/turnos?day=${toISODate(date)}`);
      }
      return;
    }

    // Alta por doble clic: el editor propio lo maneja.
    if (args.requestType === "eventCreate") {
      args.cancel = true;
      const record = (Array.isArray(args.data) ? args.data[0] : args.data) as Partial<ScheduleEvent> | undefined;
      setCreateStart(record?.StartTime ? new Date(record.StartTime) : defaultNewTime(currentDateRef.current));
      return;
    }

    // Tecla Delete: confirmar antes de borrar.
    if (args.requestType === "eventRemove") {
      args.cancel = true;
      const record = args.deletedRecords?.[0];
      if (record) setDeleting(findEvent(String(record.Id)));
    }
  }

  async function handleActionComplete(args: ActionEventArgs) {
    // Después de navegar, estirar el rango cargado si hizo falta.
    if (args.requestType === "navigating") {
      void ensureRange(currentDateRef.current);
      return;
    }

    // Drag & drop / resize terminados: persistir el nuevo horario. En
    // actionBegin llega con requestType 'eventChange' y en actionComplete con
    // 'eventChanged' (pasado) — acá se persiste después del cambio visual.
    if (args.requestType === "eventChanged") {
      lastMutationRef.current = Date.now();
      const changed = args.changedRecords?.[0];
      if (!changed) return;

      const id = String(changed.Id);
      const start = new Date(changed.StartTime);
      const end = new Date(changed.EndTime);
      const duration = Math.round((end.getTime() - start.getTime()) / 60_000);

      if (!Number.isFinite(duration) || duration <= 0) return;

      const formData = new FormData();
      formData.set("appointmentId", id);
      formData.set("day", toISODate(start));
      formData.set("time", toHHMM(start));
      formData.set("durationMinutes", String(duration));

      const result = await moveAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        await refreshFromServer();
        return;
      }

      setEvents((prev) =>
        prev.map((event) =>
          event.Id === id
            ? { ...event, StartTime: start, EndTime: end, durationMinutes: duration }
            : event,
        ),
      );
    }
  }

  function handlePopupOpen(args: PopupOpenEventArgs) {
    // Sin editor ni quick info de EJ2: los diálogos propios lo reemplazan.
    if (args.type === "Editor" || args.type === "QuickInfo" || args.type === "EditEventInfo" || args.type === "ViewEventInfo") {
      args.cancel = true;
    }

    // Doble clic sobre un turno: EJ2 iba a abrir su editor con los datos.
    if (args.type === "Editor") {
      const record = args.data as Partial<ScheduleEvent> | undefined;
      if (record?.Id) {
        const event = findEvent(String(record.Id)) ?? (record as ScheduleEvent);
        setEditing(event);
      }
    }
  }

  function handleEventClick(args: EventClickArgs) {
    // El clic que cierra un drag no debe abrir la ficha.
    if (Date.now() - lastMutationRef.current < 600) return;
    const record = args.event as Partial<ScheduleEvent>;
    if (!record?.Id) return;
    const event = findEvent(String(record.Id));
    if (event) setEditing(event);
  }

  function handleCellDoubleClick(args: CellClickEventArgs) {
    setCreateStart(args.startTime);
  }

  // ── Alta / edición / estado / borrado ─────────────────────────────────────

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !createStart) return;
    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("day", toISODate(createStart));
      const result = await createAction(formData);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      setCreateStart(null);
      // Pintar el turno al toque y reconciliar con el servidor en segundo
      // plano (el roundtrip de la server action tarda, el alta no debería).
      if (result.id) {
        const start = parseDayTime(text(formData, "day") || toISODate(createStart), text(formData, "time") || toHHMM(createStart));
        setEvents((prev) =>
          [...prev, toScheduleEvent(buildLocalRow(formData, result.id!, start, references))].sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime()),
        );
      }
      void refreshFromServer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agendar el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editing) return;
    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("appointmentId", editing.Id);
      const result = await updateAction(formData);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      // Actualizar el turno en el Scheduler al toque; el refresh de fondo
      // reconcilia (nombres resueltos del servidor, etc.).
      const start = parseDayTime(text(formData, "day"), text(formData, "time"));
      setEvents((prev) =>
        prev.map((event) =>
          event.Id === editing.Id
            ? toScheduleEvent(buildLocalRow(formData, editing.Id, start, references, {
                status: editing.status,
                saleId: editing.saleId,
              }))
            : event,
        ),
      );
      setEditing(null);
      void refreshFromServer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: AppointmentStatusValue) {
    if (busy || !editing) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", editing.Id);
      formData.set("status", status);
      const result = await setStatusAction(formData);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      setEditing((prev) => (prev ? { ...prev, status } : prev));
      // El badge del Scheduler cambia al toque; el refresh de fondo reconcilia.
      setEvents((prev) =>
        prev.map((event) =>
          event.Id === editing.Id
            ? { ...event, status, CssClass: `e-turno-${status.toLowerCase()}` }
            : event,
        ),
      );
      void refreshFromServer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (busy || !deleting) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("appointmentId", deleting.Id);
      const result = await deleteAction(formData);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      // Desaparece al toque; el refresh de fondo reconcilia.
      setEvents((prev) => prev.filter((event) => event.Id !== deleting.Id));
      setDeleting(null);
      setEditing(null);
      void refreshFromServer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar el turno.");
    } finally {
      setBusy(false);
    }
  }

  const editingChargeable = editing
    ? editing.status !== "CANCELLED" && editing.status !== "NO_SHOW" && !editing.saleId
    : false;

  const durationOptions = useMemo(() => {
    const base = DURATIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }));
    const duration = editing?.durationMinutes ?? 30;
    return base.some((option) => option.value === String(duration))
      ? base
      : [{ value: String(duration), label: `${duration} min` }, ...base];
  }, [editing]);

  const showCustomers = references.customers.length > 0;

  return (
    <div className="space-y-4">
      <StatTiles
        tiles={[
          { label: "Turnos del día", value: String(dayEvents.length), amount: dayEvents.length, kind: "int" },
          {
            label: "Por atender",
            value: String(pending),
            amount: pending,
            kind: "int",
            tone: pending > 0 ? "info" : "neutral",
          },
          {
            label: "Atendidos",
            value: String(done),
            amount: done,
            kind: "int",
            tone: done > 0 ? "positive" : "neutral",
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton onClick={() => setCreateStart(defaultNewTime(currentDateRef.current))}>Nuevo turno</ActionButton>
        <p className="text-xs font-semibold text-slate-500">
          Tocá dos veces un horario para agendar · arrastrá para mover · estirá el borde para alargar
        </p>
      </div>

      <ScheduleComponent
        actionBegin={handleActionBegin}
        actionComplete={handleActionComplete}
        allowDragAndDrop
        allowResizing
        cellDoubleClick={handleCellDoubleClick}
        cssClass="e-turnos-schedule"
        currentView="Day"
        endHour={END_HOUR}
        eventClick={handleEventClick}
        eventSettings={eventSettings}
        firstDayOfWeek={1}
        popupOpen={handlePopupOpen}
        ref={scheduleRef}
        selectedDate={parseDay(initialDay)}
        showHeaderBar
        showQuickInfo={false}
        startHour={START_HOUR}
        timeScale={TIMESCALE}
        views={VIEWS}
        width="100%"
      >
        <Inject services={[Day, Week, Agenda, DragAndDrop, Resize]} />
      </ScheduleComponent>

      {/* ── Alta de turno ── */}
      <DialogComponent
        close={() => setCreateStart(null)}
        cssClass="e-turnos-dialog"
        header="Agendar un turno"
        isModal
        showCloseIcon
        visible={createStart !== null}
        width="92%"
      >
        {createStart ? (
          <form className="grid gap-3 sm:grid-cols-2" key={`new-${createStart.getTime()}`} onSubmit={handleCreateSubmit}>
            <Field label="Fecha">
              <input className={inputClass} readOnly value={longDate(createStart)} />
            </Field>
            <Field label="Hora">
              <input className={inputClass} defaultValue={toHHMM(createStart)} name="time" required type="time" />
            </Field>

            <Field label="Duración">
              <SyncSelect
                ariaLabel="Duración"
                defaultValue="30"
                name="durationMinutes"
                options={DURATIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))}
              />
            </Field>

            <Field label={references.staffLabel}>
              <SyncSelect
                ariaLabel="Quién atiende"
                name="staffId"
                options={references.staffs.map((staff) => ({ value: staff.id, label: staff.name }))}
                placeholder="Sin asignar"
              />
            </Field>

            <Field label="Cliente" hint="Si no está en la ficha, escribí el nombre">
              <input className={inputClass} name="customerName" placeholder="Ej: Juan" />
            </Field>

            <Field label="Teléfono">
              <input className={inputClass} name="customerPhone" placeholder="11 5555-5555" />
            </Field>

            {showCustomers ? (
              <Field label="…o un cliente ya cargado">
                <SyncSelect
                  ariaLabel="Cliente"
                  name="customerId"
                  options={references.customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                  placeholder="Ninguno"
                />
              </Field>
            ) : null}

            <Field label={references.productLabel}>
              <SyncSelect
                ariaLabel="Servicio"
                name="productId"
                options={references.products.map((product) => ({ value: product.id, label: product.name }))}
                placeholder="Sin especificar"
              />
            </Field>

            {references.branches.length > 1 ? (
              <Field label="Sucursal">
                <SyncSelect
                  ariaLabel="Sucursal"
                  defaultValue={references.branches[0]?.id}
                  name="branchId"
                  options={references.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Field>
            ) : (
              <input name="branchId" type="hidden" value={references.branches[0]?.id ?? ""} />
            )}

            <Field className="sm:col-span-2" label="Nota">
              <input className={inputClass} name="notes" placeholder="Viene con la hermana" />
            </Field>

            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <GhostActionButton onClick={() => setCreateStart(null)}>Cancelar</GhostActionButton>
              <ActionButton disabled={busy} submit>
                {busy ? "Guardando…" : "Agendar"}
              </ActionButton>
            </div>
          </form>
        ) : null}
      </DialogComponent>

      {/* ── Ficha / edición de turno ── */}
      <DialogComponent
        close={() => setEditing(null)}
        cssClass="e-turnos-dialog"
        header="Turno"
        isModal
        showCloseIcon
        visible={editing !== null}
        width="92%"
      >
        {editing ? (
          <form className="grid gap-3 sm:grid-cols-2" key={`edit-${editing.Id}`} onSubmit={handleUpdateSubmit}>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Badge tone={STATUS_TONES[editing.status]}>{STATUS_LABELS[editing.status]}</Badge>
              {editing.saleId ? <Badge tone="positive">Cobrado</Badge> : null}
              {editing.staffName ? (
                <span className="text-xs font-bold text-slate-500">{editing.staffName}</span>
              ) : null}
            </div>

            <Field label="Fecha">
              <input className={inputClass} name="day" type="date" defaultValue={toISODate(editing.StartTime)} required />
            </Field>
            <Field label="Hora">
              <input className={inputClass} name="time" type="time" defaultValue={toHHMM(editing.StartTime)} required />
            </Field>

            <Field label="Duración">
              <SyncSelect
                ariaLabel="Duración"
                defaultValue={String(editing.durationMinutes)}
                name="durationMinutes"
                options={durationOptions}
              />
            </Field>

            <Field label={references.staffLabel}>
              <SyncSelect
                ariaLabel="Quién atiende"
                defaultValue={editing.staffId ?? ""}
                name="staffId"
                options={references.staffs.map((staff) => ({ value: staff.id, label: staff.name }))}
                placeholder="Sin asignar"
              />
            </Field>

            <Field label="Cliente" hint="Si no está en la ficha, escribí el nombre">
              <input className={inputClass} defaultValue={editing.customerName ?? ""} name="customerName" placeholder="Ej: Juan" />
            </Field>

            <Field label="Teléfono">
              <input className={inputClass} defaultValue={editing.customerPhone ?? ""} name="customerPhone" placeholder="11 5555-5555" />
            </Field>

            {showCustomers ? (
              <Field label="…o un cliente ya cargado">
                <SyncSelect
                  ariaLabel="Cliente"
                  defaultValue={editing.customerId ?? ""}
                  name="customerId"
                  options={references.customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                  placeholder="Ninguno"
                />
              </Field>
            ) : null}

            <Field label={references.productLabel}>
              <SyncSelect
                ariaLabel="Servicio"
                defaultValue={editing.productId ?? ""}
                name="productId"
                options={references.products.map((product) => ({ value: product.id, label: product.name }))}
                placeholder="Sin especificar"
              />
            </Field>

            {references.branches.length > 1 ? (
              <Field label="Sucursal">
                <SyncSelect
                  ariaLabel="Sucursal"
                  defaultValue={editing.branchId}
                  name="branchId"
                  options={references.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Field>
            ) : (
              <input name="branchId" type="hidden" value={editing.branchId} />
            )}

            <Field className="sm:col-span-2" label="Nota">
              <input className={inputClass} defaultValue={editing.notes ?? ""} name="notes" placeholder="Viene con la hermana" />
            </Field>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              {editing.status === "SCHEDULED" ? (
                <GhostActionButton disabled={busy} onClick={() => void changeStatus("CONFIRMED")}>
                  Confirmar
                </GhostActionButton>
              ) : null}
              {editingChargeable ? (
                <GhostActionButton disabled={busy} onClick={() => void changeStatus("NO_SHOW")}>
                  No vino
                </GhostActionButton>
              ) : null}
              {editingChargeable ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-black text-white transition active:scale-95"
                  href={`/sales/new?appointment=${editing.Id}`}
                >
                  Cobrar
                </Link>
              ) : null}
              <div className="ml-auto">
                <GhostActionButton disabled={busy} onClick={() => setDeleting(editing)}>
                  Borrar
                </GhostActionButton>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <GhostActionButton onClick={() => setEditing(null)}>Cancelar</GhostActionButton>
              <ActionButton disabled={busy} submit>
                {busy ? "Guardando…" : "Guardar cambios"}
              </ActionButton>
            </div>
          </form>
        ) : null}
      </DialogComponent>

      {/* ── Confirmación de borrado ── */}
      <DialogComponent
        close={() => setDeleting(null)}
        cssClass="e-turnos-dialog"
        header="¿Borrar el turno?"
        isModal
        showCloseIcon
        visible={deleting !== null}
        width="92%"
      >
        {deleting ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-600">
              Se va a borrar el turno de{" "}
              <span className="font-black text-slate-950">{deleting.customerName ?? "Sin nombre"}</span> a las{" "}
              <span className="font-black text-slate-950">{toHHMM(deleting.StartTime)}</span>. No se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2">
              <GhostActionButton onClick={() => setDeleting(null)}>Cancelar</GhostActionButton>
              <ActionButton className="bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={() => void confirmDelete()}>
                {busy ? "Borrando…" : "Sí, borrar"}
              </ActionButton>
            </div>
          </div>
        ) : null}
      </DialogComponent>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Arma un turno local a partir del form del editor para pintarlo al toque
// (alta/edición optimista) con los nombres resueltos desde las referencias.
function buildLocalRow(
  form: FormData,
  id: string,
  start: Date,
  refs: TurnoReferenceData,
  overrides: Partial<Pick<ScheduleEvent, "status" | "saleId">> = {},
): TurnoEventData {
  const staffId = text(form, "staffId") || null;
  const productId = text(form, "productId") || null;
  const customerId = text(form, "customerId") || null;
  const customerName = text(form, "customerName");

  return {
    id,
    startsAt: start.toISOString(),
    durationMinutes: Math.max(1, Number(text(form, "durationMinutes") || "30") || 30),
    status: overrides.status ?? "SCHEDULED",
    notes: text(form, "notes") || null,
    customerName: customerName || (customerId ? refs.customers.find((c) => c.id === customerId)?.name ?? null : null),
    customerPhone: text(form, "customerPhone") || null,
    customerId,
    saleId: overrides.saleId ?? null,
    staffId,
    staffName: refs.staffs.find((s) => s.id === staffId)?.name ?? null,
    productId,
    productName: refs.products.find((p) => p.id === productId)?.name ?? null,
    branchId: text(form, "branchId") || (refs.branches[0]?.id ?? ""),
  };
}

function parseDayTime(day: string, time: string): Date {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dayMatch || !timeMatch) return new Date();
  return new Date(
    Number(dayMatch[1]),
    Number(dayMatch[2]) - 1,
    Number(dayMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
}

function toScheduleEvent(row: TurnoEventData): ScheduleEvent {
  const start = new Date(row.startsAt);
  return {
    Id: row.id,
    Subject: row.customerName ?? "Sin nombre",
    StartTime: start,
    EndTime: new Date(start.getTime() + row.durationMinutes * 60_000),
    CssClass: `e-turno-${row.status.toLowerCase()}`,
    durationMinutes: row.durationMinutes,
    status: row.status,
    notes: row.notes,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    saleId: row.saleId,
    customerId: row.customerId,
    staffId: row.staffId,
    staffName: row.staffName,
    productId: row.productId,
    productName: row.productName,
    branchId: row.branchId,
  };
}

function parseDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfDay(new Date());
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, delta: number): Date {
  const copy = new Date(date);
  copy.setDate(date.getDate() + delta);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

function toHHMM(date: Date): string {
  return `${date.getHours()}`.padStart(2, "0") + ":" + `${date.getMinutes()}`.padStart(2, "0");
}

function longDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

// Horario por defecto para el alta: hoy = próximo slot libre desde ahora
// (redondeado a 30 min); cualquier otro día, las 10:00. Si el resultado cae
// fuera del horario visible del Scheduler (07:00–23:00), se clampa a las
// 10:00 para que el turno nunca quede invisible.
function defaultNewTime(date: Date): Date {
  const base = new Date(date);
  const now = new Date();
  if (isSameDay(base, now)) {
    const minutes = now.getMinutes();
    const rounded = minutes < 30 ? 30 : 60;
    base.setHours(now.getHours(), rounded, 0, 0);
  } else {
    base.setHours(10, 0, 0, 0);
  }

  const hour = base.getHours();
  if (hour < 7 || hour > 22) {
    base.setHours(10, 0, 0, 0);
  }
  return base;
}
