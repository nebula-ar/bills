import { requireAdminSession } from "@/lib/auth";
import { getBarbersForManagement } from "@/modules/barbers/get-barbers-for-management.use-case";
import { BarbersManager, type BarberRow, type BarbersData } from "@/components/barbers-manager";

type BarbersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function BarbersPage({ searchParams }: BarbersPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const { barbers, branches } = await getBarbersForManagement(session.user.businessId);

  const rows: BarberRow[] = barbers.map((barber) => ({
    id: barber.id,
    name: barber.name,
    branchId: barber.branchId,
    branchLabel: barber.branch ? barber.branch.name : "Sin sucursal",
    active: barber.active,
    hasPin: Boolean(barber.pinHash),
  }));

  const businessName =
    branches[0]?.business.name ?? barbers.find((barber) => barber.branch)?.branch?.business.name ?? "Barber Bills";

  const data: BarbersData = {
    businessName,
    barbers: rows,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    flash,
  };

  return <BarbersManager data={data} />;
}

function getSingleParam(value: string | string[] | undefined) {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function getFlash(
  status: string | string[] | undefined,
  message: string | string[] | undefined,
): { status: "success" | "error"; message: string } | null {
  const s = getSingleParam(status);
  const m = getSingleParam(message);
  if ((s === "success" || s === "error") && m) {
    return { status: s, message: m };
  }
  return null;
}
