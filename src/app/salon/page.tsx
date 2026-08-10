import { AppModule, TableStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getTablero } from "@/modules/tables/tables.use-cases";
import { SalonManager, type SalonData } from "@/components/salon-manager";

/**
 * El tablero del salón. Esta página solo lee y arma los datos; la pantalla
 * entera —filtros, sectores plegables, el `+` flotante— la pinta
 * `SalonManager` del lado del cliente. Ver ese componente para el porqué.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function minutosDesde(fecha: Date): number {
  return Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
}

type SalonPageProps = {
  searchParams: Promise<{ branchId?: string | string[] }>;
};

export default async function SalonPage({ searchParams }: SalonPageProps) {
  const { session } = await requireModule(AppModule.TABLES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";
  const tablero = branchId ? await getTablero(session.user.businessId, branchId) : [];

  const data: SalonData = {
    sucursales: sucursales.map((s) => ({ id: s.id, name: s.name })),
    branchId,
    tablero: tablero.map((sector) => ({
      id: sector.id,
      name: sector.name,
      mesas: sector.mesas.map((mesa) => ({
        id: mesa.id,
        name: mesa.name,
        seats: mesa.seats,
        status: mesa.status,
        sectorId: sector.id,
        ocupada: mesa.status === TableStatus.OCCUPIED || mesa.comanda !== null,
        consumo: mesa.comanda
          ? { total: mesa.comanda.total, items: mesa.comanda.items, esperaMin: minutosDesde(mesa.comanda.abiertaDesde) }
          : null,
      })),
    })),
  };

  return <SalonManager data={data} />;
}
