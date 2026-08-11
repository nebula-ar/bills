import { AppShell, PageHeader } from "@/components/app-shell";
import { PeriodFade } from "@/components/period-fade";
import { StatTiles } from "@/components/stat-tiles";
import { AppointmentFormHandler } from "@/components/appointment-form-handler";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  Badge,
  EmptyState,
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
  SectionCard,
  type Tone,
} from "@/components/manager-ui";
import { AppModule, AppointmentStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getDayAppointments } from "@/modules/appointments/appointment.use-cases";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { findCatalogForPromotions } from "@/modules/catalog/product.repository";
import { getCustomersForSale } from "@/modules/customers/customer.use-cases";
import { getStaffsForManagement } from "@/modules/staff/get-staff-for-management.use-case";
import Link from "next/link";

import { deleteAppointmentAction, setStatusFormAction } from "./actions";
import { SelectField } from "@/components/ui/select-field";

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: "Anotado",
  [AppointmentStatus.CONFIRMED]: "Confirmado",
  [AppointmentStatus.DONE]: "Atendido",
  [AppointmentStatus.CANCELLED]: "Cancelado",
  [AppointmentStatus.NO_SHOW]: "No vino",
};

const STATUS_TONES: Record<AppointmentStatus, Tone> = {
  [AppointmentStatus.SCHEDULED]: "info",
  [AppointmentStatus.CONFIRMED]: "positive",
  [AppointmentStatus.DONE]: "neutral",
  [AppointmentStatus.CANCELLED]: "danger",
  [AppointmentStatus.NO_SHOW]: "warning",
};

// Duraciones típicas de un servicio. Se ofrecen como botones para no hacer
// pensar en minutos exactos mientras hay alguien esperando al teléfono.
const DURATIONS = [15, 30, 45, 60, 90];

type TurnosPageProps = {
  searchParams: Promise<{ day?: string | string[]; status?: string | string[]; message?: string | string[] }>;
};

export default async function TurnosPage({ searchParams }: TurnosPageProps) {
  const { business } = await requireModule(AppModule.APPOINTMENTS);

  const params = await searchParams;
  const day = parseDay(single(params.day));

  const [appointments, branches, { staffs }, catalog, customers] = await Promise.all([
    getDayAppointments({ businessId: business.id, day }),
    getBranchesForManagement(business.id),
    getStaffsForManagement(business.id),
    findCatalogForPromotions(business.id),
    business.has(AppModule.CUSTOMERS) ? getCustomersForSale(business.id) : Promise.resolve([]),
  ]);

  const activeBranches = branches.filter((branch) => branch.active);
  const activeStaff = staffs.filter((staff) => staff.active);

  const pending = appointments.filter(
    (appointment) =>
      appointment.status === AppointmentStatus.SCHEDULED || appointment.status === AppointmentStatus.CONFIRMED,
  );
  const done = appointments.filter((appointment) => appointment.status === AppointmentStatus.DONE);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Turnos"
        description="La agenda del día. Cuando el cliente se levanta de la silla, cobrás desde acá."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600" href={`/turnos?day=${shiftDay(day, -1)}`}>
          ← Día anterior
        </Link>
        <span className="text-sm font-black capitalize text-slate-950">{dayFormatter.format(day)}</span>
        <Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600" href={`/turnos?day=${shiftDay(day, 1)}`}>
          Día siguiente →
        </Link>
        <Link className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white" href="/turnos">
          Hoy
        </Link>
      </div>

      <StatTiles
        tiles={[
          { label: "Turnos del día", value: String(appointments.length), amount: appointments.length, kind: "int" },
          {
            label: "Por atender",
            value: String(pending.length),
            amount: pending.length,
            kind: "int",
            tone: pending.length > 0 ? "info" : "neutral",
          },
          {
            label: "Atendidos",
            value: String(done.length),
            amount: done.length,
            kind: "int",
            tone: done.length > 0 ? "positive" : "neutral",
          },
        ]}
      />

      <SectionCard title="Agenda" description="En orden de horario.">
        <PeriodFade period={`day-${toISODate(day)}`}>
        {appointments.length === 0 ? (
          <EmptyState title="No hay turnos para este día." hint="Agendá uno abajo." />
        ) : (
          <ul className="space-y-2.5">
            {appointments.map((appointment) => {
              const who = appointment.customer?.name ?? appointment.customerName ?? "Sin nombre";
              const phone = appointment.customer?.phone ?? appointment.customerPhone;
              const chargeable =
                appointment.status !== AppointmentStatus.CANCELLED &&
                appointment.status !== AppointmentStatus.NO_SHOW &&
                !appointment.saleId;

              return (
                <li className="rounded-2xl border border-slate-200 p-3.5" key={appointment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-slate-950">
                          {timeFormatter.format(appointment.startsAt)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{appointment.durationMinutes} min</span>
                        <Badge tone={STATUS_TONES[appointment.status]}>{STATUS_LABELS[appointment.status]}</Badge>
                        {appointment.saleId ? <Badge tone="positive">Cobrado</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-950">{who}</p>
                      <p className="text-xs text-slate-500">
                        {appointment.product?.name ?? "Sin servicio"}
                        {appointment.staff ? ` · ${appointment.staff.name}` : " · sin asignar"}
                        {phone ? ` · ${phone}` : ""}
                      </p>
                      {appointment.notes ? (
                        <p className="mt-1 text-xs italic text-slate-500">{appointment.notes}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {chargeable ? (
                        <Link
                          className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white transition active:scale-95"
                          href={`/sales/new?appointment=${appointment.id}`}
                        >
                          Cobrar
                        </Link>
                      ) : null}

                      {appointment.status === AppointmentStatus.SCHEDULED ? (
                        <form action={setStatusFormAction}>
                          <input name="appointmentId" type="hidden" value={appointment.id} />
                          <input name="day" type="hidden" value={toISODate(day)} />
                          <input name="status" type="hidden" value={AppointmentStatus.CONFIRMED} />
                          <GhostButton>Confirmar</GhostButton>
                        </form>
                      ) : null}

                      {chargeable ? (
                        <form action={setStatusFormAction}>
                          <input name="appointmentId" type="hidden" value={appointment.id} />
                          <input name="day" type="hidden" value={toISODate(day)} />
                          <input name="status" type="hidden" value={AppointmentStatus.NO_SHOW} />
                          <GhostButton>No vino</GhostButton>
                        </form>
                      ) : null}

                      <ConfirmDeleteButton
                        action={deleteAppointmentAction}
                        confirmLabel="Sí, borrar"
                        description={
                          <>
                            Se va a borrar el turno de{" "}
                            <span className="font-black">{who}</span> a las{" "}
                            <span className="font-black">{timeFormatter.format(appointment.startsAt)}</span>.
                            No se puede deshacer.
                          </>
                        }
                        fields={{ appointmentId: appointment.id }}
                        successMessage="Turno borrado."
                        title="¿Borrar el turno?"
                      >
                        Borrar
                      </ConfirmDeleteButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </PeriodFade>
      </SectionCard>

      <SectionCard title="Agendar un turno" description="Si el horario se pisa con otro, te avisamos antes de guardar.">
        <AppointmentFormHandler>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input name="day" type="hidden" value={toISODate(day)} />

          <Field label="Hora">
            <input className={inputClass} defaultValue="10:00" name="time" required type="time" />
          </Field>

          <Field label="Duración">
            <SelectField
              ariaLabel="Duración"
              defaultValue="30"
              name="durationMinutes"
              options={DURATIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))}
            />
          </Field>

          <Field label={business.labels.staffSingular}>
            <SelectField
              ariaLabel="Quién atiende"
              name="staffId"
              options={[
                { value: "", label: "Sin asignar" },
                ...activeStaff.map((staff) => ({ value: staff.id, label: staff.name })),
              ]}
            />
          </Field>

          <Field label="Cliente" hint="Si no está en la ficha, escribí el nombre">
            <input className={inputClass} name="customerName" placeholder="Ej: Juan" />
          </Field>

          <Field label="Teléfono">
            <input className={inputClass} name="customerPhone" placeholder="11 5555-5555" />
          </Field>

          {customers.length > 0 ? (
            <Field label="…o un cliente ya cargado">
              <SelectField
                ariaLabel="Cliente"
                name="customerId"
                options={[
                  { value: "", label: "Ninguno" },
                  ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
                ]}
              />
            </Field>
          ) : null}

          <Field label={business.labels.catalogSingular}>
            <SelectField
              ariaLabel="Servicio"
              name="productId"
              options={[
                { value: "", label: "Sin especificar" },
                ...catalog.products.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
          </Field>

          {activeBranches.length > 1 ? (
            <Field label="Sucursal">
              <SelectField
                ariaLabel="Sucursal"
                name="branchId"
                options={activeBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
              />
            </Field>
          ) : (
            <input name="branchId" type="hidden" value={activeBranches[0]?.id ?? ""} />
          )}

          <Field label="Nota" className="sm:col-span-2">
            <input className={inputClass} name="notes" placeholder="Viene con la hermana" />
          </Field>

          <PrimaryButton className="sm:col-span-2 lg:col-span-3">Agendar</PrimaryButton>
          </form>
        </AppointmentFormHandler>
      </SectionCard>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function parseDay(value: string | undefined): Date {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function shiftDay(day: Date, delta: number) {
  const next = new Date(day);
  next.setDate(day.getDate() + delta);
  return toISODate(next);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}
