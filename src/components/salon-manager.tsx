"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import {
  alternarOcupacionAction,
  crearMesaAction,
  crearSectorAction,
  editarMesaAction,
  editarSectorAction,
  eliminarMesaAction,
  eliminarSectorAction,
} from "@/app/salon/actions";
import { Badge, formatMoney, inputClass } from "@/components/manager-ui";
import { StatTiles } from "@/components/stat-tiles";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SelectField } from "@/components/ui/select-field";
import { ChevronDown, MapPin, MoreHorizontal, Pencil, Plus, RotateCcw, TableService, Trash2, X } from "@/components/icons";
import { TableStatus } from "@/generated/prisma/enums";

/**
 * El tablero del salón: qué mesa está libre, cuál está ocupada y cuánto lleva
 * consumido cada una. Panel operativo, no pantalla de configuración: por eso
 * vive del lado del cliente —filtros, sectores que se pliegan, un `+`
 * flotante— en vez de la vieja lista con un formulario "Agregar" siempre
 * abierto ocupando la mitad de la pantalla.
 */

export type MesaVM = {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  ocupada: boolean;
  sectorId: string | null;
  consumo: { total: number; items: number; esperaMin: number } | null;
};

export type SectorVM = {
  id: string | null;
  name: string;
  mesas: MesaVM[];
};

export type SalonData = {
  sucursales: { id: string; name: string }[];
  branchId: string;
  tablero: SectorVM[];
};

type Filtro = "todas" | "ocupadas" | "libres";

function sectorKey(sector: SectorVM) {
  return sector.id ?? "sin-sector";
}

function pasaFiltro(mesa: MesaVM, filtro: Filtro) {
  if (filtro === "ocupadas") return mesa.ocupada;
  if (filtro === "libres") return !mesa.ocupada;
  return true;
}

function MesaCard({
  mesa,
  onAlternar,
  onAcciones,
}: {
  mesa: MesaVM;
  onAlternar: (mesa: MesaVM) => void;
  onAcciones: (mesa: MesaVM) => void;
}) {
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-2xl border p-4 transition ${
        mesa.ocupada ? "border-primary/40 bg-primary/10" : "border-slate-200 bg-white"
      }`}
    >
      {/* Fuera del Link a propósito: un botón no puede anidarse en un link, y
          esto tiene que abrir el menú, no navegar a la comanda. */}
      <button
        aria-label={`Acciones de ${mesa.name}`}
        className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-950/10 hover:text-slate-700"
        onClick={() => onAcciones(mesa)}
        type="button"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {/* La tarjeta entera lleva a la comanda: el mozo toca la mesa, no busca
          un botón adentro de la tarjeta. */}
      <Link className="flex flex-col gap-2" href={`/salon/${mesa.id}`}>
        <div className="flex items-start justify-between gap-2 pr-7">
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight tracking-tight text-slate-950">{mesa.name}</p>
            <p className="text-xs text-slate-500">{mesa.seats} lugares</p>
          </div>
          <Badge tone={mesa.ocupada ? "info" : "positive"}>{mesa.ocupada ? "Ocupada" : "Libre"}</Badge>
        </div>

        {mesa.consumo ? (
          <div className="rounded-xl bg-white/70 px-3 py-2">
            <p className="text-xl font-black text-primary">{formatMoney(mesa.consumo.total)}</p>
            <p className="text-xs text-slate-500">
              {mesa.consumo.items} {mesa.consumo.items === 1 ? "ítem" : "ítems"} · hace {mesa.consumo.esperaMin} min
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin consumo</p>
        )}
      </Link>

      {/* Secundaria: alineada a la derecha, no una fila propia todo el ancho. */}
      <button
        className="self-end rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-950/5 hover:text-slate-700"
        onClick={() => onAlternar(mesa)}
        type="button"
      >
        {mesa.ocupada ? "Liberar" : "Sentar gente"}
      </button>
    </div>
  );
}

export function SalonManager({ data }: { data: SalonData }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  // Copia local del tablero: crear un sector/mesa o alternar ocupación
  // actualiza esto DIRECTO con el resultado ya confirmado por el servidor, sin
  // depender de que `router.refresh()` vuelva a pedir el árbol. En este fork
  // de Next ese refresh no siempre repinta la pantalla que ya está montada
  // -es la misma causa que ya se documentó en la comanda-, así que acá no es
  // el único mecanismo: es un best-effort. Se resincroniza durante el render
  // (no en un efecto: React lo pide así para "ajustar estado cuando cambia
  // una prop", sin la pasada de más que dispara un `useEffect`) cuando sí
  // trae datos nuevos (cambiar de sucursal, "Actualizar").
  const [tablero, setTablero] = useState<SectorVM[]>(data.tablero);
  const [tableroPrevio, setTableroPrevio] = useState(data.tablero);
  if (data.tablero !== tableroPrevio) {
    setTableroPrevio(data.tablero);
    setTablero(data.tablero);
  }

  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.tablero.map((s) => [sectorKey(s), s.mesas.length > 0])),
  );
  const [crear, setCrear] = useState<null | "elegir" | "mesa" | "sector">(null);
  const [accionSector, setAccionSector] = useState<{ sector: SectorVM; paso: "menu" | "editar" | "eliminar" } | null>(
    null,
  );
  const [accionMesa, setAccionMesa] = useState<{ mesa: MesaVM; paso: "menu" | "editar" | "eliminar" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleSector(key: string) {
    setAbiertos((actual) => ({ ...actual, [key]: !actual[key] }));
  }

  function cerrarCrear() {
    setCrear(null);
    setError(null);
  }

  function alternarMesa(mesa: MesaVM) {
    setError(null);
    const nuevoStatus = mesa.status === TableStatus.OCCUPIED ? TableStatus.FREE : TableStatus.OCCUPIED;

    startTransition(async () => {
      const resultado = await alternarOcupacionAction({
        tableId: mesa.id,
        status: mesa.status,
        tieneComandaAbierta: mesa.consumo !== null,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setTablero((actual) =>
        actual.map((sector) => ({
          ...sector,
          mesas: sector.mesas.map((m) =>
            m.id === mesa.id ? { ...m, status: nuevoStatus, ocupada: nuevoStatus === TableStatus.OCCUPIED } : m,
          ),
        })),
      );
      router.refresh();
    });
  }

  function crearSectorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = String(new FormData(event.currentTarget).get("name") ?? "").trim();

    setError(null);
    startTransition(async () => {
      const resultado = await crearSectorAction({ branchId: data.branchId, name: nombre });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      const nuevoId = resultado.sectorId ?? null;
      setTablero((actual) => [...actual, { id: nuevoId, name: nombre, mesas: [] }]);
      // Se abre solo: si no, el sector nuevo aparece plegado y parece que la
      // mesa que se cree a continuación se perdió.
      if (nuevoId) setAbiertos((actual) => ({ ...actual, [nuevoId]: true }));
      setCrear(null);
      router.refresh();
    });
  }

  function crearMesaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const nombre = String(datos.get("name") ?? "").trim();
    const sectorId = String(datos.get("sectorId") ?? "");
    const seats = Number(datos.get("seats") || 4);

    setError(null);
    startTransition(async () => {
      const resultado = await crearMesaAction({
        branchId: data.branchId,
        sectorId: sectorId || null,
        name: nombre,
        seats,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (resultado.mesaId) {
        const nuevaMesa: MesaVM = {
          id: resultado.mesaId,
          name: nombre,
          seats,
          status: TableStatus.FREE,
          ocupada: false,
          sectorId: sectorId || null,
          consumo: null,
        };
        setTablero((actual) =>
          actual.map((sector) => (sector.id === sectorId ? { ...sector, mesas: [...sector.mesas, nuevaMesa] } : sector)),
        );
      }
      setCrear(null);
      router.refresh();
    });
  }

  function cerrarAccionSector() {
    setAccionSector(null);
    setError(null);
  }

  function editarSectorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sectorId = accionSector?.sector.id;
    if (!sectorId) return;
    const nombre = String(new FormData(event.currentTarget).get("name") ?? "").trim();

    setError(null);
    startTransition(async () => {
      const resultado = await editarSectorAction({ sectorId, branchId: data.branchId, name: nombre });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setTablero((actual) => actual.map((s) => (s.id === sectorId ? { ...s, name: nombre } : s)));
      setAccionSector(null);
      router.refresh();
    });
  }

  function eliminarSectorConfirm() {
    const sectorId = accionSector?.sector.id;
    if (!sectorId) return;

    setError(null);
    startTransition(async () => {
      const resultado = await eliminarSectorAction({ sectorId, branchId: data.branchId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      // Las mesas del sector no se borran: caen en "Sin sector", mismo
      // criterio que ya usa el servidor (softDeleteSector) para no volverlas
      // invisibles.
      setTablero((actual) => {
        const sector = actual.find((s) => s.id === sectorId);
        if (!sector) return actual;
        const resto = actual.filter((s) => s.id !== sectorId);
        if (sector.mesas.length === 0) return resto;

        const idxSinSector = resto.findIndex((s) => s.id === null);
        if (idxSinSector >= 0) {
          return resto.map((s, i) => (i === idxSinSector ? { ...s, mesas: [...s.mesas, ...sector.mesas] } : s));
        }
        return [...resto, { id: null, name: "Sin sector", mesas: sector.mesas }];
      });
      setAccionSector(null);
      router.refresh();
    });
  }

  function cerrarAccionMesa() {
    setAccionMesa(null);
    setError(null);
  }

  function editarMesaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mesaId = accionMesa?.mesa.id;
    if (!mesaId) return;
    const datos = new FormData(event.currentTarget);
    const nombre = String(datos.get("name") ?? "").trim();
    const sectorId = String(datos.get("sectorId") ?? "") || null;
    const seats = Number(datos.get("seats") || 4);

    setError(null);
    startTransition(async () => {
      const resultado = await editarMesaAction({ tableId: mesaId, branchId: data.branchId, sectorId, name: nombre, seats });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setTablero((actual) => {
        let mesaActualizada: MesaVM | null = null;
        const sinLaMesa = actual.map((sector) => {
          const encontrada = sector.mesas.find((m) => m.id === mesaId);
          if (!encontrada) return sector;
          mesaActualizada = { ...encontrada, name: nombre, seats, sectorId };
          return { ...sector, mesas: sector.mesas.filter((m) => m.id !== mesaId) };
        });
        if (!mesaActualizada) return actual;
        return sinLaMesa.map((sector) =>
          sector.id === sectorId ? { ...sector, mesas: [...sector.mesas, mesaActualizada as MesaVM] } : sector,
        );
      });
      setAccionMesa(null);
      router.refresh();
    });
  }

  function eliminarMesaConfirm() {
    const mesaId = accionMesa?.mesa.id;
    if (!mesaId) return;

    setError(null);
    startTransition(async () => {
      const resultado = await eliminarMesaAction({ tableId: mesaId });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setTablero((actual) => actual.map((sector) => ({ ...sector, mesas: sector.mesas.filter((m) => m.id !== mesaId) })));
      setAccionMesa(null);
      router.refresh();
    });
  }

  const mesas = tablero.flatMap((s) => s.mesas);
  const ocupadas = mesas.filter((m) => m.ocupada);
  const consumoPendiente = ocupadas.reduce((suma, m) => suma + (m.consumo?.total ?? 0), 0);

  const sectoresReales = tablero.filter((s): s is SectorVM & { id: string } => s.id !== null);
  const primerSectorId = sectoresReales[0]?.id ?? "";

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-2xl overflow-x-clip bg-[var(--background)] px-4 pb-28 pt-6 text-slate-950 lg:max-w-4xl lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Bills</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Salón</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
            Qué mesa está ocupada y cuánto lleva consumido cada una.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 active:scale-95"
            onClick={() => router.refresh()}
            type="button"
          >
            <RotateCcw className="size-3.5" />
            Actualizar
          </button>
          {data.sucursales.length > 1 ? (
            <SelectField
              ariaLabel="Sucursal"
              defaultValue={data.branchId}
              onChange={(value) => router.push(`/salon?branchId=${value}`)}
              options={data.sucursales.map((s) => ({ value: s.id, label: s.name }))}
              size="sm"
            />
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
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
              value: formatMoney(consumoPendiente),
              amount: consumoPendiente,
              kind: "money",
              hint: "Consumo sin cobrar",
            },
          ]}
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["todas", "Todas", mesas.length],
            ["ocupadas", "Ocupadas", ocupadas.length],
            ["libres", "Libres", mesas.length - ocupadas.length],
          ] as [Filtro, string, number][]
        ).map(([valor, etiqueta, cantidad]) => (
          <button
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
              filtro === valor ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
            }`}
            key={valor}
            onClick={() => setFiltro(valor)}
            type="button"
          >
            {etiqueta}
            <span className={`rounded-full px-1.5 text-xs ${filtro === valor ? "bg-white/20" : "bg-slate-100"}`}>
              {cantidad}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {tablero.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
            <p className="text-sm font-bold text-slate-700">Todavía no hay mesas</p>
            <p className="mt-1 text-xs text-slate-500">Tocá el botón «+» para crear el primer sector.</p>
          </div>
        ) : (
          tablero.map((sector) => {
            const key = sectorKey(sector);
            const abierto = abiertos[key] ?? false;
            const visibles = sector.mesas.filter((m) => pasaFiltro(m, filtro));
            const ocupadasEnSector = sector.mesas.filter((m) => m.ocupada).length;

            return (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={key}>
                <div className="flex items-center gap-1">
                  <button
                    className="flex flex-1 items-center justify-between gap-3 text-left"
                    onClick={() => toggleSector(key)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black tracking-tight text-slate-950">{sector.name}</h2>
                        {ocupadasEnSector > 0 ? (
                          <Badge tone="info">
                            {ocupadasEnSector} {ocupadasEnSector === 1 ? "ocupada" : "ocupadas"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {sector.mesas.length === 1
                          ? "1 mesa en este sector"
                          : `${sector.mesas.length} mesas en este sector`}
                      </p>
                    </div>
                    <ChevronDown className={`size-5 shrink-0 text-slate-400 transition ${abierto ? "rotate-180" : ""}`} />
                  </button>
                  {/* "Sin sector" es un balde sintético para mesas huérfanas, no
                      un sector real: no se edita ni se elimina. */}
                  {sector.id ? (
                    <button
                      aria-label={`Acciones de ${sector.name}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-950/5 hover:text-slate-700"
                      onClick={() => setAccionSector({ sector, paso: "menu" })}
                      type="button"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  ) : null}
                </div>

                {abierto ? (
                  <div className="mt-3">
                    {visibles.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                        {sector.mesas.length === 0 ? "Este sector no tiene mesas todavía." : "Ninguna mesa con este filtro."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {visibles.map((mesa) => (
                          <MesaCard
                            key={mesa.id}
                            mesa={mesa}
                            onAcciones={(m) => setAccionMesa({ mesa: m, paso: "menu" })}
                            onAlternar={alternarMesa}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>

      {/* Elegir qué crear */}
      <BottomSheet onClose={cerrarCrear} open={crear === "elegir"}>
        <div className="flex items-center justify-between px-5 pt-6">
          <h3 className="text-xl font-black tracking-tight text-slate-950">Agregar</h3>
          <button
            aria-label="Cerrar"
            className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
            onClick={cerrarCrear}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
          <button
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99] disabled:opacity-50"
            disabled={sectoresReales.length === 0}
            onClick={() => setCrear("mesa")}
            type="button"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <TableService className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">Nueva mesa</span>
              <span className="block text-xs text-slate-500">
                {sectoresReales.length === 0 ? "Creá un sector primero" : "Se agrega al sector que elijas"}
              </span>
            </span>
          </button>
          <button
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
            onClick={() => setCrear("sector")}
            type="button"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">Nuevo sector</span>
              <span className="block text-xs text-slate-500">Agrupa mesas: Salón, Vereda, Barra</span>
            </span>
          </button>
        </div>
      </BottomSheet>

      {/* Nueva mesa */}
      <BottomSheet onClose={cerrarCrear} open={crear === "mesa"}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={crearMesaSubmit}>
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nueva mesa</h3>
            <button
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
              onClick={cerrarCrear}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          {error ? <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Sector
              <SelectField
                ariaLabel="Sector"
                defaultValue={primerSectorId}
                name="sectorId"
                options={sectoresReales.map((s) => ({ value: s.id, label: s.name }))}
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nombre
              <input className={inputClass} maxLength={40} name="name" placeholder="Ej: Mesa 5" required type="text" />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Lugares
              <input className={inputClass} defaultValue={4} max={40} min={1} name="seats" type="number" />
            </label>
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              Crear mesa
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Nuevo sector */}
      <BottomSheet onClose={cerrarCrear} open={crear === "sector"}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={crearSectorSubmit}>
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo sector</h3>
            <button
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
              onClick={cerrarCrear}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          {error ? <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nombre
              <input className={inputClass} maxLength={40} name="name" placeholder="Ej: Vereda" required type="text" />
            </label>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Los sectores agrupan mesas: Salón, Vereda, Barra.
            </p>
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              Crear sector
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Acciones de sector: editar / eliminar */}
      <BottomSheet onClose={cerrarAccionSector} open={accionSector !== null}>
        {accionSector ? (
          accionSector.paso === "menu" ? (
            <>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="min-w-0 truncate text-xl font-black tracking-tight text-slate-950">
                  {accionSector.sector.name}
                </h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionSector}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
                <button
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                  onClick={() => setAccionSector({ sector: accionSector.sector, paso: "editar" })}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Pencil className="size-5" />
                  </span>
                  <span className="text-sm font-black text-slate-950">Editar nombre</span>
                </button>
                <button
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                  onClick={() => setAccionSector({ sector: accionSector.sector, paso: "eliminar" })}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <Trash2 className="size-5" />
                  </span>
                  <span className="text-sm font-black text-destructive">Eliminar sector</span>
                </button>
              </div>
            </>
          ) : accionSector.paso === "editar" ? (
            <form className="flex min-h-0 flex-1 flex-col" key={accionSector.sector.id} onSubmit={editarSectorSubmit}>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Editar sector</h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionSector}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              {error ? (
                <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
              ) : null}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className={inputClass}
                    defaultValue={accionSector.sector.name}
                    maxLength={40}
                    name="name"
                    required
                    type="text"
                  />
                </label>
              </div>
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                <button
                  className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Eliminar sector</h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionSector}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              {error ? (
                <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
              ) : null}
              <div className="px-5 pb-6 pt-5">
                <p className="text-sm text-slate-700">
                  ¿Eliminar <span className="font-black">{accionSector.sector.name}</span>?
                </p>
                {accionSector.sector.mesas.length > 0 ? (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    Sus {accionSector.sector.mesas.length} {accionSector.sector.mesas.length === 1 ? "mesa" : "mesas"} no
                    se borran: quedan en «Sin sector».
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button
                    className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-bold text-slate-600"
                    onClick={() => setAccionSector({ sector: accionSector.sector, paso: "menu" })}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    className="h-11 flex-1 rounded-full bg-destructive text-sm font-black text-white disabled:opacity-60"
                    disabled={isPending}
                    onClick={eliminarSectorConfirm}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </>
          )
        ) : null}
      </BottomSheet>

      {/* Acciones de mesa: editar / eliminar */}
      <BottomSheet onClose={cerrarAccionMesa} open={accionMesa !== null}>
        {accionMesa ? (
          accionMesa.paso === "menu" ? (
            <>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="min-w-0 truncate text-xl font-black tracking-tight text-slate-950">
                  {accionMesa.mesa.name}
                </h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionMesa}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
                <button
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                  onClick={() => setAccionMesa({ mesa: accionMesa.mesa, paso: "editar" })}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Pencil className="size-5" />
                  </span>
                  <span className="text-sm font-black text-slate-950">Editar mesa</span>
                </button>
                <button
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                  onClick={() => setAccionMesa({ mesa: accionMesa.mesa, paso: "eliminar" })}
                  type="button"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <Trash2 className="size-5" />
                  </span>
                  <span className="text-sm font-black text-destructive">Eliminar mesa</span>
                </button>
              </div>
            </>
          ) : accionMesa.paso === "editar" ? (
            <form className="flex min-h-0 flex-1 flex-col" key={accionMesa.mesa.id} onSubmit={editarMesaSubmit}>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Editar mesa</h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionMesa}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              {error ? (
                <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
              ) : null}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Sector
                  <SelectField
                    ariaLabel="Sector"
                    defaultValue={accionMesa.mesa.sectorId ?? ""}
                    name="sectorId"
                    options={[
                      { value: "", label: "Sin sector" },
                      ...sectoresReales.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className={inputClass}
                    defaultValue={accionMesa.mesa.name}
                    maxLength={40}
                    name="name"
                    required
                    type="text"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Lugares
                  <input
                    className={inputClass}
                    defaultValue={accionMesa.mesa.seats}
                    max={40}
                    min={1}
                    name="seats"
                    type="number"
                  />
                </label>
              </div>
              <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
                <button
                  className="w-full rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 pt-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Eliminar mesa</h3>
                <button
                  aria-label="Cerrar"
                  className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={cerrarAccionMesa}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              {error ? (
                <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
              ) : null}
              <div className="px-5 pb-6 pt-5">
                {accionMesa.mesa.ocupada ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    Esta mesa está ocupada. Liberala antes de eliminarla.
                  </p>
                ) : (
                  <p className="text-sm text-slate-700">
                    ¿Eliminar <span className="font-black">{accionMesa.mesa.name}</span>?
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-bold text-slate-600"
                    onClick={() => setAccionMesa({ mesa: accionMesa.mesa, paso: "menu" })}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    className="h-11 flex-1 rounded-full bg-destructive text-sm font-black text-white disabled:opacity-60"
                    disabled={isPending || accionMesa.mesa.ocupada}
                    onClick={eliminarMesaConfirm}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </>
          )
        ) : null}
      </BottomSheet>

      <button
        aria-label="Agregar mesa o sector"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={() => setCrear("elegir")}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
