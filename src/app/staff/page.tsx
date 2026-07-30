import { AppModule } from "@/generated/prisma/client";
import { requireBusinessContext } from "@/lib/business-context";
import { verticalPreset } from "@/lib/vertical";
import { getStaffsForManagement } from "@/modules/staff/get-staff-for-management.use-case";
import { StaffsManager, type StaffRow, type StaffsData } from "@/components/staff-manager";

type StaffsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function StaffsPage({ searchParams }: StaffsPageProps) {
  const { business } = await requireBusinessContext();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const { staffs, branches } = await getStaffsForManagement(business.id);

  const rows: StaffRow[] = staffs.map((staff) => ({
    id: staff.id,
    name: staff.name,
    branchId: staff.branchId,
    branchLabel: staff.branch ? staff.branch.name : "Sin sucursal",
    active: staff.active,
    canCloseCash: staff.canCloseCash,
    commissionRate: staff.commissionRate,
    hasPin: Boolean(staff.pinHash),
  }));

  const businessName =
    branches[0]?.business.name ?? staffs.find((staff) => staff.branch)?.branch?.business.name ?? "Bills";

  const data: StaffsData = {
    staffIcon: verticalPreset(business.vertical).staffIcon,
    showsCommissions: business.has(AppModule.STAFF_COMMISSIONS),
    staffSingular: business.labels.staffSingular,
    staffPlural: business.labels.staffPlural,
    businessName,
    staffs: rows,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    flash,
  };

  return <StaffsManager data={data} />;
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
