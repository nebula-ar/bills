import { AppShell, PageHeader } from "@/components/app-shell";
import { SyncfusionTurnosProvider } from "@/components/syncfusion-turnos-provider";
import { TurnosSchedule } from "@/components/turnos-schedule";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getAppointmentsRange } from "@/modules/appointments/appointment.use-cases";
import { serializeAppointment } from "@/modules/appointments/appointment.serialization";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { findCatalogForPromotions } from "@/modules/catalog/product.repository";
import { getCustomersForSale } from "@/modules/customers/customer.use-cases";
import { getStaffsForManagement } from "@/modules/staff/get-staff-for-management.use-case";
import type { TurnoReferenceData } from "./types";

import {
  createAppointmentAction,
  deleteAppointmentAction,
  getAppointmentsRangeAction,
  moveAppointmentAction,
  setStatusAction,
  updateAppointmentAction,
} from "./actions";

// Ventana inicial que se siembra en el cliente: ±15 días alrededor de la
// fecha elegida. El Scheduler pide más cuando navega más allá (ver
// turnos-schedule.tsx).
const MARGIN_DAYS = 15;

type TurnosPageProps = {
  searchParams: Promise<{ day?: string | string[] }>;
};

export default async function TurnosPage({ searchParams }: TurnosPageProps) {
  const { business } = await requireModule(AppModule.APPOINTMENTS);

  const params = await searchParams;
  const day = parseDay(single(params.day));

  const [appointments, branches, { staffs }, catalog, customers] = await Promise.all([
    getAppointmentsRange({
      businessId: business.id,
      from: startOfDay(addDays(day, -MARGIN_DAYS)),
      to: endOfDay(addDays(day, MARGIN_DAYS)),
    }),
    getBranchesForManagement(business.id),
    getStaffsForManagement(business.id),
    findCatalogForPromotions(business.id),
    business.has(AppModule.CUSTOMERS) ? getCustomersForSale(business.id) : Promise.resolve([]),
  ]);

  const activeBranches = branches.filter((branch) => branch.active);
  const activeStaff = staffs.filter((staff) => staff.active);

  const references: TurnoReferenceData = {
    branches: activeBranches.map((branch) => ({ id: branch.id, name: branch.name })),
    staffs: activeStaff.map((staff) => ({ id: staff.id, name: staff.name })),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    products: catalog.products.map((product) => ({ id: product.id, name: product.name })),
    staffLabel: business.labels.staffSingular,
    productLabel: business.labels.catalogSingular,
  };

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Turnos"
        description="La agenda del día. Cuando el cliente se levanta de la silla, cobrás desde acá."
      />

      <SyncfusionTurnosProvider>
        <TurnosSchedule
          createAction={createAppointmentAction}
          deleteAction={deleteAppointmentAction}
          getRangeAction={getAppointmentsRangeAction}
          initialDay={toISODate(day)}
          initialEvents={appointments.map(serializeAppointment)}
          moveAction={moveAppointmentAction}
          references={references}
          setStatusAction={setStatusAction}
          updateAction={updateAppointmentAction}
        />
      </SyncfusionTurnosProvider>
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

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + delta);
  return next;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}
