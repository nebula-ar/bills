import { requireAdminSession } from "@/lib/auth";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { BranchesManager, type BranchRow, type BranchesData } from "@/components/branches-manager";

type BranchesPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const branches = await getBranchesForManagement(session.user.businessId);

  const rows: BranchRow[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    address: branch.address,
    active: branch.active,
  }));

  const data: BranchesData = {
    businessName: branches[0]?.business.name ?? "Barber Bills",
    branches: rows,
    flash,
  };

  return <BranchesManager data={data} />;
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
