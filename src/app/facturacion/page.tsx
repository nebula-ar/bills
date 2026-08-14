import { requireAdminSession } from "@/lib/auth";
import { findBusinessFiscalData } from "@/modules/business/business.repository";
import { FiscalProfileManager, type FiscalProfileData, type ComprobanteRow } from "@/components/fiscal-profile-manager";
import { SyncfusionFacturacionProvider } from "@/components/syncfusion-facturacion-provider";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { toSalesListSale } from "@/modules/sales/recent-sales-view";

type FacturacionPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

// Etiqueta compacta de fecha para la grilla: "14/08/26 09:24". El historial de
// ventas usa una fecha larga porque es una ficha; acá es una columna.
const fechaFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function FacturacionPage({ searchParams }: FacturacionPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const business = await findBusinessFiscalData(session.user.businessId);

  // Historial de comprobantes: las ventas completadas del negocio con su
  // estado AFIP (emitida/pendiente/fallida/sin configurar). Se reutilizan los
  // mismos módulos que el historial de ventas para no duplicar mapeos ni la
  // lógica del QR fiscal. El DataGrid pagina en memoria sobre estas filas.
  const businessBasics = { cuit: business?.cuit ?? null, salesPointNumber: business?.salesPointNumber ?? null };
  const { sales } = await getRecentSales(session.user.businessId, 50);
  const comprobantes: ComprobanteRow[] = sales
    .filter((sale) => sale.status === "COMPLETED")
    .map((sale) => {
      const view = toSalesListSale(sale, businessBasics);
      return {
        id: sale.id,
        fechaLabel: fechaFormatter.format(sale.soldAt),
        detalle: view.itemSummary,
        cliente: view.customerName,
        invoiceType: sale.invoiceType,
        afipStatus: sale.afipStatus,
        afipError: sale.afipError,
        cae: sale.cae,
        caeVencimiento: view.caeVencimiento,
        afipVoucherNumber: sale.afipVoucherNumber,
        qrUrl: view.qrUrl,
        total: sale.total,
      };
    });

  const data: FiscalProfileData = {
    businessName: business?.name ?? "Bills",
    cuit: business?.cuit ?? null,
    taxCondition: business?.taxCondition ?? null,
    salesPointNumber: business?.salesPointNumber ?? null,
    hasCertificate: Boolean(business?.afipCertAlias),
    certificateCreatedAt: business?.afipCertCreatedAt?.toISOString() ?? null,
    flash,
    comprobantes,
  };

  return (
    <SyncfusionFacturacionProvider>
      <FiscalProfileManager data={data} />
    </SyncfusionFacturacionProvider>
  );
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
