import { requireAdminSession } from "@/lib/auth";
import { getBranchServiceConfiguration } from "@/modules/services/get-branch-service-configuration.use-case";
import { ServicesManager, type ServiceRow, type ServicesData } from "@/components/services-manager";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type ServicesPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const selectedBranchId = getSingleParam(params.branchId);
  const flash = getFlash(params.status, params.message);
  const { branches, selectedBranch, services } = await getBranchServiceConfiguration(selectedBranchId);

  if (!selectedBranch) {
    return (
      <main className="mx-auto min-h-screen max-w-[560px] px-4 pb-28 pt-6 text-slate-950">
        <h1 className="text-2xl font-black tracking-tight">Servicios</h1>
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargá una sucursal para administrar servicios.
        </div>
      </main>
    );
  }

  const rows: ServiceRow[] = services.map((service) => {
    const { branchPrice, suggestedPrice, configured } = service;
    const available = branchPrice?.active ?? false;

    const statusTone: ServiceRow["statusTone"] = !configured ? "unconfigured" : available ? "available" : "unavailable";
    const statusLabel = !configured ? "Sin configurar" : available ? "Disponible" : "No disponible";
    const priceLabel = branchPrice
      ? money(branchPrice.price)
      : suggestedPrice
        ? `~ ${money(suggestedPrice)}`
        : "Sin precio";

    const branchConfigs = branches.map((branch) => {
      const config = service.branchPrices.find((price) => price.branchId === branch.id) ?? null;
      const suggested = service.branchPrices.find((price) => price.branchId !== branch.id)?.price ?? null;

      return {
        branchId: branch.id,
        configured: config !== null,
        available: config?.active ?? false,
        priceValue: String(config?.price ?? suggested ?? ""),
      };
    });

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      configured,
      available,
      priceLabel,
      statusLabel,
      statusTone,
      branchConfigs,
    };
  });

  const data: ServicesData = {
    businessName: selectedBranch.business.name,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    selectedBranchId: selectedBranch.id,
    services: rows,
    flash,
  };

  return <ServicesManager data={data} />;
}

function money(value: number) {
  return moneyFormatter.format(value);
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
