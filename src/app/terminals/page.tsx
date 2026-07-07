import { requireAdminSession } from "@/lib/auth";
import { getTerminalsManagementData } from "@/modules/terminals/terminal.use-cases";
import { TerminalsManager, type TerminalsBranch, type TerminalsData } from "@/components/terminals-manager";

type TerminalsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
    branchId?: string | string[];
  }>;
};

export default async function TerminalsPage({ searchParams }: TerminalsPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const selectedParam = getSingleParam(params.branchId);
  const branches = await getTerminalsManagementData();

  const rows: TerminalsBranch[] = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    barbers: branch.users.map((barber) => ({ id: barber.id, name: barber.name })),
    customTerminals: branch.terminals.map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      barberId: terminal.barberId,
      barberName: terminal.barber?.name ?? null,
    })),
  }));

  const selectedBranchId = rows.find((branch) => branch.id === selectedParam)?.id ?? rows[0]?.id ?? "";

  const data: TerminalsData = {
    businessName: branches[0]?.business.name ?? "Barber Bills",
    branches: rows,
    selectedBranchId,
    flash,
  };

  return <TerminalsManager data={data} />;
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
