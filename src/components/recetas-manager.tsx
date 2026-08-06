"use client";

import { useState } from "react";

import { crearInsumoAction, ponerEnRecetaAction, ponerVencimientoAction, sacarDeRecetaAction } from "@/app/recetas/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SelectField } from "@/components/ui/select-field";
import { Plus, Search, X } from "@/components/icons";
import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, sanitizeQuantityInput, unitShort } from "@/lib/quantity";

/**
 * Insumos y recetas.
 *
 * La pantalla contestaba "qué lleva cada producto" y callaba lo único que se
 * quiere saber: si conviene hacerlo. Ahora el costo de la receta se compara con
 * el precio de venta, y cada insumo dice qué parte del costo se lleva — que es
 * lo que decide con qué proveedor conviene pelear el precio.
 *
 * Los dos formularios sueltos al pie pasan a modales: cargar un insumo y poner
 * uno en la receta son cosas que se hacen de vez en cuando, y tenerlas siempre
 * abiertas empujaba abajo las listas que sí se miran todos los días.
 */

export type InsumoRow = {
  id: string;
  name: string;
  unit: Unit;
  cost: number | null;
  stock: number;
  minStock: number | null;
  bajo: boolean;
  expiresAt: string | null;
  vencimiento: "sin-fecha" | "ok" | "pronto" | "hoy" | "vencido";
  textoVencimiento: string | null;
};

export type RecetaRenglon = {
  id: string;
  ingredienteId: string;
  nombre: string;
  unit: Unit;
  cantidad: number;
  costo: number;
  porcentaje: number;
  sinCosto: boolean;
};

export type ElaborableRow = {
  id: string;
  name: string;
  renglones: number;
};

const dinero = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function RecetasManager({
  insumos,
  elaborables,
  producto,
  renglones,
  costo,
  sinCostear,
  margen,
  precio,
  branchId,
  unidades,
}: {
  insumos: InsumoRow[];
  elaborables: ElaborableRow[];
  producto: ElaborableRow | null;
  renglones: RecetaRenglon[];
  costo: number;
  sinCostear: number;
  margen: { ganancia: number; porcentaje: number } | null;
  precio: number | null;
  branchId: string;
  unidades: { value: string; label: string }[];
}) {
  const [tab, setTab] = useState<"receta" | "insumos">("receta");
  const [busqueda, setBusqueda] = useState("");
  const [nuevoInsumo, setNuevoInsumo] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [venciendo, setVenciendo] = useState<InsumoRow | null>(null);

  const normalizar = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const consulta = normalizar(busqueda.trim());
  const visibles = consulta ? insumos.filter((i) => normalizar(i.name).includes(consulta)) : insumos;

  return (
    <>
      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            { key: "receta", label: "Recetas", cantidad: elaborables.length },
            { key: "insumos", label: "Insumos", cantidad: insumos.length },
          ] as const
        ).map((pestana) => (
          <button
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-black transition ${
              tab === pestana.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            key={pestana.key}
            onClick={() => setTab(pestana.key)}
            type="button"
          >
            {pestana.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                tab === pestana.key ? "bg-primary/10" : "bg-slate-100 text-slate-500"
              }`}
            >
              {pestana.cantidad}
            </span>
          </button>
        ))}
      </div>

      {tab === "receta" ? (
        <div className="space-y-4">
          {elaborables.length === 0 ? (
            <Vacio texto="Todavía no hay productos que se elaboren." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {elaborables.map((p) => (
                  <a
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-black transition ${
                      p.id === producto?.id
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                    }`}
                    href={`/recetas?producto=${p.id}`}
                    key={p.id}
                  >
                    {p.name}
                    {/* Cuántos insumos tiene, no un tilde: "3" dice que la
                        receta está cargada Y cuánto tiene; el ✓ solo lo
                        primero. */}
                    <span
                      className={`rounded-full px-1.5 text-xs ${
                        p.id === producto?.id ? "bg-white/20" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.renglones}
                    </span>
                  </a>
                ))}
              </div>

              {producto ? (
                <>
                  {/* Lo que se viene a saber: cuánto sale hacerlo y qué queda.
                      Antes el costo estaba escondido en el subtítulo de la
                      sección, en letra chica. */}
                  {/* Sin receta cargada el costo NO es cero: es desconocido. Un
                      "$0" ahí daría "margen 100%", que es la mentira más cara
                      que puede decir esta pantalla —hace creer que se gana todo
                      lo que entra— justo en los productos a los que todavía no
                      se les cargó nada. */}
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-950/5 lg:grid-cols-4">
                    <Dato
                      destacado
                      etiqueta="Cuesta hacer uno"
                      valor={renglones.length === 0 ? "Sin receta" : dinero.format(costo)}
                    />
                    <Dato etiqueta="Se vende a" valor={precio !== null ? dinero.format(precio) : "Sin precio"} />
                    {renglones.length > 0 && margen ? (
                      <>
                        <Dato
                          etiqueta="Queda"
                          tono={margen.ganancia < 0 ? "malo" : "bueno"}
                          valor={dinero.format(margen.ganancia)}
                        />
                        <Dato
                          etiqueta="Margen"
                          tono={margen.porcentaje < 0 ? "malo" : "bueno"}
                          valor={`${margen.porcentaje}%`}
                        />
                      </>
                    ) : (
                      <div className="col-span-2 bg-white px-4 py-3.5">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Margen</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-500">
                          {renglones.length === 0
                            ? "Cargá la receta para saber qué te queda de cada uno."
                            : `Ponele precio a ${producto.name} para saber qué te queda.`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Un total al que le faltan insumos no es un total: decirlo
                      evita que alguien fije el precio sobre media cuenta. */}
                  {sinCostear > 0 ? (
                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                      {sinCostear === 1
                        ? "Un insumo no tiene costo cargado, así que este total está incompleto."
                        : `${sinCostear} insumos no tienen costo cargado, así que este total está incompleto.`}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">Lleva</p>
                    {insumos.length > 0 ? (
                      <button
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white transition active:scale-95"
                        onClick={() => setAgregando(true)}
                        type="button"
                      >
                        <Plus className="size-3.5" />
                        Agregar insumo
                      </button>
                    ) : null}
                  </div>

                  {renglones.length === 0 ? (
                    <Vacio texto={`${producto.name} todavía no tiene receta.`} />
                  ) : (
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 text-left">
                            <Th>Insumo</Th>
                            <Th>Lleva</Th>
                            <Th alineado="derecha">Cuesta</Th>
                            <Th alineado="derecha">Del costo</Th>
                            <Th alineado="derecha">Quitar</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {renglones.map((r) => (
                            <tr className="border-b border-slate-50 last:border-0" key={r.id}>
                              <td className="w-full max-w-0 truncate px-4 py-3 text-sm font-bold text-slate-950">
                                {r.nombre}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                                {formatQuantity(r.cantidad, r.unit)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-slate-800">
                                {r.sinCosto ? <span className="text-amber-700">sin costo</span> : dinero.format(r.costo)}
                              </td>
                              {/* Dónde se va la plata: con esto se sabe con qué
                                  proveedor conviene pelear el precio. */}
                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <span
                                      className="block h-full rounded-full bg-primary"
                                      style={{ width: `${Math.min(r.porcentaje, 100)}%` }}
                                    />
                                  </span>
                                  <span className="w-9 text-right text-xs font-black text-slate-500">
                                    {r.porcentaje}%
                                  </span>
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                <form action={sacarDeRecetaAction}>
                                  <input name="recipeItemId" type="hidden" value={r.id} />
                                  <input name="productId" type="hidden" value={producto.id} />
                                  <button
                                    aria-label={`Quitar ${r.nombre}`}
                                    className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                    type="submit"
                                  >
                                    <X className="size-4" />
                                  </button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-100 bg-slate-50">
                            <td className="px-4 py-3 text-sm font-black text-slate-600" colSpan={2}>
                              {renglones.length} {renglones.length === 1 ? "insumo" : "insumos"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-base font-black text-slate-950">
                              {dinero.format(costo)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {insumos.length > 6 ? (
              <div className="relative min-w-[16rem] flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar insumo…"
                  value={busqueda}
                />
              </div>
            ) : (
              <span className="flex-1" />
            )}
            <button
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-black text-white transition active:scale-95"
              onClick={() => setNuevoInsumo(true)}
              type="button"
            >
              <Plus className="size-4" />
              Nuevo insumo
            </button>
          </div>

          {visibles.length === 0 ? (
            <Vacio texto={consulta ? "No encontramos nada con eso." : "Todavía no hay insumos cargados."} />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <Th>Insumo</Th>
                    <Th>Hay</Th>
                    <Th alineado="derecha">Costo</Th>
                    <Th>Vence</Th>
                    <Th alineado="derecha">Fecha</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((i) => (
                    <tr className="border-b border-slate-50 last:border-0" key={i.id}>
                      <td className="w-full max-w-0 px-4 py-3">
                        <p className="truncate text-sm font-bold text-slate-950">{i.name}</p>
                        {i.minStock !== null ? (
                          <p className="text-xs text-slate-400">Avisar bajo {formatQuantity(i.minStock, i.unit)}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                            i.bajo ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {formatQuantity(i.stock, i.unit)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">
                        {i.cost ? (
                          `${dinero.format(i.cost)} / ${unitShort(i.unit)}`
                        ) : (
                          <span className="font-bold text-amber-700">sin costo</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {i.textoVencimiento ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                              i.vencimiento === "vencido" || i.vencimiento === "hoy"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {i.textoVencimiento}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {/* La fecha se edita en un modal y no con un input por
                            fila: veinte campos de fecha abiertos a la vez son
                            veinte formularios pidiendo que los toques. */}
                        <button
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition active:scale-95 hover:bg-slate-200"
                          onClick={() => setVenciendo(i)}
                          type="button"
                        >
                          {i.expiresAt ? "Cambiar" : "Poner"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal abierto={nuevoInsumo} onClose={() => setNuevoInsumo(false)} titulo="Nuevo insumo">
        <form action={crearInsumoAction} className="grid gap-3">
          <Campo etiqueta="Nombre">
            <input className={campoClase} name="name" placeholder="Ej: Harina 000" required />
          </Campo>
          <Campo etiqueta="Se compra por">
            <SelectField ariaLabel="Unidad" defaultValue="KG" name="unit" options={unidades} />
          </Campo>
          <Campo etiqueta="Costo por unidad" ayuda="Lo que pagás por un kilo, un litro, una unidad.">
            <input className={campoClase} inputMode="numeric" name="cost" placeholder="2000" />
          </Campo>
          <Campo etiqueta="Avisar cuando queden menos de">
            <input className={campoClase} inputMode="decimal" name="minStock" placeholder="5" />
          </Campo>
          <Guardar>Crear insumo</Guardar>
        </form>
      </Modal>

      <Modal abierto={agregando} onClose={() => setAgregando(false)} titulo={`Agregar a ${producto?.name ?? ""}`}>
        <form action={ponerEnRecetaAction} className="grid gap-3">
          <input name="productId" type="hidden" value={producto?.id ?? ""} />
          <Campo etiqueta="Insumo">
            <SelectField
              ariaLabel="Insumo"
              name="ingredientId"
              options={insumos.map((i) => ({ value: i.id, label: `${i.name} (${unitShort(i.unit)})` }))}
            />
          </Campo>
          <Campo etiqueta="Cuánto lleva UNA unidad" ayuda="En la misma medida en que comprás el insumo.">
            <CantidadInput name="quantity" placeholder="0,12" />
          </Campo>
          <Guardar>Poner en la receta</Guardar>
        </form>
      </Modal>

      <Modal
        abierto={venciendo !== null}
        onClose={() => setVenciendo(null)}
        titulo={`Vencimiento de ${venciendo?.name ?? ""}`}
      >
        <form action={ponerVencimientoAction} className="grid gap-3">
          <input name="branchId" type="hidden" value={branchId} />
          <input name="productId" type="hidden" value={venciendo?.id ?? ""} />
          <Campo etiqueta="Vence el" ayuda="Vacío borra la fecha.">
            <input
              className={campoClase}
              defaultValue={venciendo?.expiresAt ?? ""}
              key={venciendo?.id}
              name="expiresAt"
              type="date"
            />
          </Campo>
          <Guardar>Guardar vencimiento</Guardar>
        </form>
      </Modal>
    </>
  );
}

const campoClase =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15";

// Filtra al escribir, igual que en stock: escribir "medio kilo" y ver el botón
// sin efecto es lo que hace sentir que la pantalla no responde.
function CantidadInput({ name, placeholder }: { name: string; placeholder: string }) {
  const [valor, setValor] = useState("");

  return (
    <input
      className={campoClase}
      inputMode="decimal"
      name={name}
      onChange={(event) => setValor(sanitizeQuantityInput(event.target.value, "KG" as Unit))}
      placeholder={placeholder}
      required
      value={valor}
    />
  );
}

function Modal({
  abierto,
  onClose,
  titulo,
  children,
}: {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <BottomSheet onClose={onClose} open={abierto}>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <div className="flex shrink-0 items-start justify-between gap-3 pb-3 pt-4">
          <h3 className="text-xl font-black tracking-tight text-slate-950">{titulo}</h3>
          <button
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </BottomSheet>
  );
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{etiqueta}</span>
      {children}
      {ayuda ? <span className="text-xs text-slate-500">{ayuda}</span> : null}
    </label>
  );
}

function Guardar({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="mt-1 w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-black text-white shadow-sm shadow-primary/25 transition active:scale-[0.99]"
      type="submit"
    >
      {children}
    </button>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
  tono = "normal",
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: "normal" | "bueno" | "malo";
}) {
  return (
    <div className="bg-white px-4 py-3.5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`font-display mt-0.5 text-2xl font-black tracking-tight ${
          tono === "malo"
            ? "text-rose-600"
            : tono === "bueno"
              ? "text-emerald-600"
              : destacado
                ? "text-primary"
                : "text-slate-950"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valor}
      </p>
    </div>
  );
}

function Th({ children, alineado = "izquierda" }: { children: React.ReactNode; alineado?: "izquierda" | "derecha" }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 ${
        alineado === "derecha" ? "text-right" : ""
      }`}
      scope="col"
    >
      {children}
    </th>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      {texto}
    </p>
  );
}
