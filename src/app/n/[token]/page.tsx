import { PublicBooking } from "@/components/public-booking";
import { PublicCatalog } from "@/components/public-catalog";
import { AppModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verticalFeatures, verticalPreset } from "@/lib/vertical";
import { availableSlots } from "@/modules/appointments/appointment.logic";
import {
  getPublicBookingOptions,
  getPublicBusiness,
  getPublicCatalog,
  getPublicDayAppointments,
} from "@/modules/marketing/marketing.use-cases";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// La página pública del negocio. Sin sesión: la abre cualquiera con el link.
//
// Qué muestra depende del rubro (ver VerticalFeatures.publicPage): una barbería
// toma reservas, una ferretería muestra su catálogo. Un kiosco no tiene página
// pública porque no la necesita.
//
// El token es la credencial y `publicPageActive` el interruptor: apagarla deja
// el link muerto en el acto.

export const dynamic = "force-dynamic";

// Horario que se ofrece por defecto. No tenemos horarios cargados por negocio
// todavía, así que se usa una franja comercial razonable y el dueño confirma.
const OPENING_HOUR = 9;
const CLOSING_HOUR = 20;
const SLOT_MINUTES = 30;
const DEFAULT_DURATION = 30;
// Cuántos días para adelante se pueden elegir.
const DAYS_AHEAD = 14;

type PublicPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ dia?: string | string[]; staff?: string | string[] }>;
};

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { token } = await params;
  const business = await getPublicBusiness(token);

  if (!business) return { title: "Bills" };

  return {
    title: business.name,
    description: business.publicNote ?? undefined,
    // Es un link para compartir, no para indexar.
    robots: { index: false, follow: false },
  };
}

export default async function PublicBusinessPage({ params, searchParams }: PublicPageProps) {
  const { token } = await params;
  const query = await searchParams;

  const business = await getPublicBusiness(token);

  if (!business) {
    notFound();
  }

  const features = verticalFeatures(business.vertical);
  const preset = verticalPreset(business.vertical);
  const branch = business.branches[0];

  if (!features.publicPage || !branch) {
    notFound();
  }

  if (features.publicPage === "catalog") {
    const products = await getPublicCatalog(business.id, branch.id);

    return (
      <PublicCatalog
        businessName={business.name}
        catalogPlural={preset.labels.catalogPlural}
        icon={preset.catalogIcon}
        note={business.publicNote}
        products={products}
        token={token}
        whatsappPhone={null}
      />
    );
  }

  // Reservar turno exige el módulo prendido: si lo apagaron, no hay página.
  const hasAppointments = await prisma.businessModuleAccess.findFirst({
    where: { businessId: business.id, module: AppModule.APPOINTMENTS },
    select: { id: true },
  });

  if (!hasAppointments) {
    notFound();
  }

  const now = new Date();
  // Sin día elegido, se arranca en el primero que todavía tenga horarios: si el
  // cliente abre el link a las 21, ofrecerle "hoy" es una pantalla vacía.
  const day = parseDay(single(query.dia), now, !single(query.dia));
  const staffParam = single(query.staff) ?? null;

  const [options, taken] = await Promise.all([
    getPublicBookingOptions(business.id, branch.id),
    getPublicDayAppointments(business.id, branch.id, day),
  ]);

  const staffId = options.staffs.some((staff) => staff.id === staffParam) ? staffParam : null;

  const dayStart = new Date(day);
  dayStart.setHours(OPENING_HOUR, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(CLOSING_HOUR, 0, 0, 0);

  const slots = availableSlots({
    dayStart,
    dayEnd,
    stepMinutes: SLOT_MINUTES,
    durationMinutes: DEFAULT_DURATION,
    staffId,
    taken: taken.map((appointment, index) => ({
      id: String(index),
      staffId: appointment.staffId,
      startsAt: appointment.startsAt,
      durationMinutes: appointment.durationMinutes,
    })),
    now,
  });

  // La tira arranca en el día que se está mirando (que puede ser mañana si hoy
  // ya cerró) y nunca muestra días pasados.
  const firstDay = day < startOfToday(now) ? startOfToday(now) : day;
  const days = Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  return (
    <PublicBooking
      branchAddress={branch.address}
      branchId={branch.id}
      businessName={business.name}
      days={days.map((date) => toISODate(date))}
      durationMinutes={DEFAULT_DURATION}
      icon={preset.icon}
      note={business.publicNote}
      selectedDay={toISODate(day)}
      selectedStaffId={staffId}
      services={options.services}
      slots={slots.map((slot) => slot.toISOString())}
      staffLabel={preset.labels.staffSingular}
      staffs={options.staffs}
      token={token}
    />
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function parseDay(value: string | undefined, now: Date, skipClosedDay = false): Date {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (!match) {
    // Ya cerró por hoy (o falta menos que un turno para cerrar): mañana.
    if (skipClosedDay && now.getHours() * 60 + now.getMinutes() > CLOSING_HOUR * 60 - DEFAULT_DURATION) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }

    return today;
  }

  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  // Nada de reservar en el pasado desde la URL.
  return day < today ? today : day;
}

function toISODate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfToday(now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}
