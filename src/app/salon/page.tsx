import Link from "next/link";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SelectField } from "@/components/ui/select-field";
import { StatTiles } from "@/components/stat-tiles";
import {
  Badge,
  EmptyState,
  Field,
  formatMoney,
  GhostButton,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { AppModule, TableStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getTablero, type MesaEnTablero } from "@/modules/tables/tables.use-cases";

import { alternarOcupacionAction, crearMesaAction, crearSectorAction } from "./actions";

/**
 * El tablero del salón: qué mesa está libre, cuál está ocupada y cuánto lleva
 * consumido cada una.
 *
 * Es la pantalla que el mozo mira entre mesa y mesa, así que lo que importa se
 * lee de un vistazo: el estado por color y el total por mesa. Lo demás
 * (crear sectores, crear mesas) vive abajo y estorba menos.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function minutosDesde(fecha: Date): number {
  return Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
}

function Mesa({ mesa, branchId, sectorId }: { mesa: MesaEnTablero; branchId: string; sectorId: string }) {
  const ocupada = mesa.status === TableStatus.OCCUPIED || mesa.comanda !== null;
  const espera = mesa.comanda ? minutosDesde(mesa.comanda.abiertaDesde) : 0;

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-4 transition ${
        ocupada ? "border-primary/40 bg-primary/10" : "border-slate-200 bg-white"
      }`}
    >
      {/* La tarjeta entera lleva a la comanda: el mozo toca la mesa, no busca
          un botón. "Sentar gente" queda aparte, abajo. */}
      <Link className="flex flex-col gap-2" href={`/salon/${mesa.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Sin `truncate`: el nombre es lo que el mozo canta en voz alta, y
                "Vere…" no le sirve a nadie. Que ocupe dos renglones. */}
            <p className="text-lg font-black leading-tight tracking-tight text-slate-950">{mesa.name}</p>
            <p className="text-xs text-slate-500">{mesa.seats} lugares</p>
          </div>
          <Badge tone={ocupada ? "info" : "positive"}>{ocupada ? "Ocupada" : "Libre"}</Badge>
        </div>

        {mesa.comanda ? (
          <div className="rounded-xl bg-white/70 px-3 py-2">
            <p className="text-xl font-black text-primary">{formatMoney(mesa.comanda.total)}</p>
            <p className="text-xs text-slate-500">
              {mesa.comanda.items} {mesa.comanda.items === 1 ? "ítem" : "ítems"} · hace {espera} min
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin consumo</p>
        )}
      </Link>

      <form action={alternarOcupacionAction} className="mt-auto">
        <input name="tableId" type="hidden" value={mesa.id} />
        <input name="branchId" type="hidden" value={branchId} />
        <input name="sectorId" type="hidden" value={sectorId} />
        <input name="status" type="hidden" value={mesa.status} />
        <input name="tieneComanda" type="hidden" value={mesa.comanda ? "1" : "0"} />
        <GhostButton className="w-full">{ocupada ? "Liberar" : "Sentar gente"}</GhostButton>
      </form>
    </div>
  );
}

type SalonPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    sector?: string | string[];
    estado?: string | string[];
    mensaje?: string | string[];
  }>;
};

export default async function SalonPage({ searchParams }: SalonPageProps) {
  const { session } = await requireModule(AppModule.TABLES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";
  const tablero = branchId ? await getTablero(session.user.businessId, branchId) : [];

  // El sector activo sale de la URL. Que viaje ahí y no en estado del cliente
  // es lo que hace que, después de crear una mesa, el mozo siga parado donde
  // estaba en vez de aparecer en otro sector.
  const sectorPedido = uno(params.sector);
  const sectorActivo = tablero.find((s) => s.id === sectorPedido) ?? tablero[0];
  const sectorId = sectorActivo?.id ?? "";

  const mesas = tablero.flatMap((s) => s.mesas);
  const ocupadas = mesas.filter((m) => m.comanda !== null || m.status === TableStatus.OCCUPIED);
  const enMesa = ocupadas.reduce((suma, m) => suma + (m.comanda?.total ?? 0), 0);

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);

  return (
    <AppShell>
      <PageHeader
        title="Salón"
        description="Qué mesa está ocupada y cuánto lleva consumido cada una."
        actions={
          sucursales.length > 1 ? (
            <form className="flex items-end gap-2">
              <Field label="Sucursal">
                <SelectField
                  ariaLabel="Sucursal"
                  defaultValue={branchId}
                  name="branchId"
                  options={sucursales.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <GhostButton>Ver</GhostButton>
            </form>
          ) : null
        }
      />

      {mensaje ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </p>
      ) : null}

      <StatTiles
        tiles={[
          { label: "Mesas", value: String(mesas.length), amount: mesas.length, kind: "int" },
          {
            label: "Ocupadas",
            value: String(ocupadas.length),
            amount: ocupadas.length,
            kind: "int",
            tone: ocupadas.length ? "info" : "neutral",
          },
          {
            label: "En el salón",
            value: formatMoney(enMesa),
            amount: enMesa,
            kind: "money",
            hint: "Consumo sin cobrar",
          },
        ]}
      />

      {tablero.length === 0 ? (
        <EmptyState
          title="Todavía no hay mesas"
          hint="Creá un sector (Salón, Vereda, Barra) y después las mesas que tenga."
        />
      ) : (
        <SectionCard
          title={sectorActivo?.name ?? "Salón"}
          description={
            (sectorActivo?.mesas.length ?? 0) === 1
              ? "1 mesa en este sector"
              : `${sectorActivo?.mesas.length ?? 0} mesas en este sector`
          }
        >
          {tablero.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {tablero.map((s) => {
                const activo = s.id === sectorId;
                return (
                  <a
                    key={s.id ?? "sin-sector"}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      activo ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    href={`/salon?branchId=${branchId}&sector=${s.id ?? ""}`}
                  >
                    {s.name}
                  </a>
                );
              })}
            </div>
          ) : null}

          {sectorActivo && sectorActivo.mesas.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sectorActivo.mesas.map((mesa) => (
                <Mesa key={mesa.id} branchId={branchId} mesa={mesa} sectorId={sectorId} />
              ))}
            </div>
          ) : (
            <EmptyState title="Este sector no tiene mesas" hint="Agregale una acá abajo." />
          )}
        </SectionCard>
      )}

      <SectionCard title="Agregar" description="Los sectores agrupan mesas: Salón, Vereda, Barra.">
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={crearSectorAction} className="flex flex-col gap-3">
            <input name="branchId" type="hidden" value={branchId} />
            <Field label="Sector nuevo">
              <input className={inputClass} maxLength={40} name="name" placeholder="Ej: Vereda" required />
            </Field>
            <PrimaryButton>Crear sector</PrimaryButton>
          </form>

          <form action={crearMesaAction} className="flex flex-col gap-3">
            <input name="branchId" type="hidden" value={branchId} />
            {/* La mesa se crea en el sector que se está MIRANDO, no en el
                primero de la lista. */}
            <input name="sectorId" type="hidden" value={sectorId} />
            <Field label={`Mesa nueva en ${sectorActivo?.name ?? "el salón"}`}>
              <input className={inputClass} maxLength={40} name="name" placeholder="Ej: Mesa 5" required />
            </Field>
            <Field label="Lugares">
              <input className={inputClass} defaultValue={4} max={40} min={1} name="seats" type="number" />
            </Field>
            <PrimaryButton>Crear mesa</PrimaryButton>
          </form>
        </div>
      </SectionCard>
    </AppShell>
  );
}
