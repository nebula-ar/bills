import { requireAdminSession } from "@/lib/auth";
import { findBusinessFiscalData } from "@/modules/business/business.repository";
import { FiscalProfileManager, type FiscalProfileData } from "@/components/fiscal-profile-manager";

type FacturacionPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function FacturacionPage({ searchParams }: FacturacionPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const business = await findBusinessFiscalData(session.user.businessId);

  const data: FiscalProfileData = {
    businessName: business?.name ?? "Bills",
    cuit: business?.cuit ?? null,
    taxCondition: business?.taxCondition ?? null,
    salesPointNumber: business?.salesPointNumber ?? null,
    hasCertificate: Boolean(business?.afipCertAlias),
    certificateCreatedAt: business?.afipCertCreatedAt?.toISOString() ?? null,
    flash,
  };

  return <FiscalProfileManager data={data} />;
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
