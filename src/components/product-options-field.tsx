"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addModifierToGroup,
  createModifierGroup,
  deleteModifierGroup,
  getProductModifierGroups,
  removeModifier,
  toggleProductModifierGroup,
  type GrupoDeOpciones,
} from "@/app/catalog/modifier-actions";
import { ChevronDown, Loader2, Plus, Trash2 } from "@/components/icons";
import { formatAmountInput, parseAmountInput } from "@/lib/money";

/**
 * Las opciones del producto, creadas y elegidas desde su ficha.
 *
 * Un grupo ("Punto de cocción") lo comparten varios productos, así que borrarlo
 * los toca a todos. Eso NO se esconde: destildar lo saca de este producto,
 * borrar se lo saca a todos, y la pantalla lo dice con esas palabras. Es la
 * única forma honesta de administrar algo compartido desde uno de los que lo
 * comparten.
 *
 * El grupo nuevo nace ya asignado a este producto: si lo creaste parado acá, es
 * porque este producto lo lleva.
 */

type OpcionNueva = { name: string; monto: string; resta: boolean };

const OPCION_VACIA: OpcionNueva = { name: "", monto: "", resta: false };

export function ProductOptionsField({ productId }: { productId: string }) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<GrupoDeOpciones[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();
  const [, startGuardado] = useTransition();

  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [obligatorio, setObligatorio] = useState(false);
  const [variasJuntas, setVariasJuntas] = useState(false);
  const [opciones, setOpciones] = useState<OpcionNueva[]>([{ ...OPCION_VACIA }]);
  const [recargas, setRecargas] = useState(0);
  // Qué grupo está desplegado para editarle las opciones. Uno solo a la vez:
  // varios abiertos convierten la ficha en una lista larga de campos.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [opcionSuelta, setOpcionSuelta] = useState<OpcionNueva>({ ...OPCION_VACIA });

  useEffect(() => {
    let vigente = true;
    startCarga(async () => {
      const resultado = await getProductModifierGroups(productId);
      if (!vigente) return;
      if (resultado.ok) {
        setGrupos(resultado.grupos);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });

    return () => {
      vigente = false;
    };
  }, [productId, recargas]);

  function recargar() {
    setRecargas((n) => n + 1);
    router.refresh();
  }

  function alternar(grupo: GrupoDeOpciones) {
    setError(null);
    setGuardandoId(grupo.id);

    // Se pinta antes de que conteste el servidor y se revierte si falla: un
    // tilde que tarda medio segundo en moverse se toca dos veces.
    setGrupos((actuales) =>
      (actuales ?? []).map((item) => (item.id === grupo.id ? { ...item, activo: !item.activo } : item)),
    );

    startGuardado(async () => {
      const resultado = await toggleProductModifierGroup({
        productId,
        groupId: grupo.id,
        incluir: !grupo.activo,
      });

      setGuardandoId(null);

      if (!resultado.ok) {
        setGrupos((actuales) =>
          (actuales ?? []).map((item) => (item.id === grupo.id ? { ...item, activo: grupo.activo } : item)),
        );
        setError(resultado.error);
        return;
      }

      router.refresh();
    });
  }

  function borrar(grupo: GrupoDeOpciones) {
    // Se pregunta con todas las letras porque el alcance no es el que la
    // pantalla sugiere: estás parado en un producto y el borrado toca a todos.
    const seguro = window.confirm(
      `"${grupo.name}" se va a borrar de TODOS los productos que lo tengan, no solo de este. ¿Seguimos?`,
    );
    if (!seguro) return;

    setError(null);
    setGuardandoId(grupo.id);

    startGuardado(async () => {
      const resultado = await deleteModifierGroup(grupo.id);
      setGuardandoId(null);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      recargar();
    });
  }

  function agregarOpcion(groupId: string) {
    setError(null);
    setGuardandoId(groupId);

    startGuardado(async () => {
      const monto = parseAmountInput(opcionSuelta.monto) ?? 0;
      const resultado = await addModifierToGroup({
        groupId,
        name: opcionSuelta.name,
        priceDelta: opcionSuelta.resta ? -monto : monto,
      });

      setGuardandoId(null);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setOpcionSuelta({ ...OPCION_VACIA });
      recargar();
    });
  }

  function sacarOpcion(modifierId: string, groupId: string) {
    setError(null);
    setGuardandoId(groupId);

    startGuardado(async () => {
      const resultado = await removeModifier(modifierId);
      setGuardandoId(null);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      recargar();
    });
  }

  function crear() {
    setError(null);

    startGuardado(async () => {
      const resultado = await createModifierGroup({
        productId,
        name: nombre,
        required: obligatorio,
        // "Varias juntas" se traduce a un tope alto en vez de pedir un número:
        // el dueño piensa "una sola" o "las que quiera", no "máximo 9".
        maxSelect: variasJuntas ? 99 : 1,
        opciones: opciones
          .filter((opcion) => opcion.name.trim().length > 0)
          .map((opcion) => {
            const monto = parseAmountInput(opcion.monto) ?? 0;
            return { name: opcion.name, priceDelta: opcion.resta ? -monto : monto };
          }),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setCreando(false);
      setNombre("");
      setObligatorio(false);
      setVariasJuntas(false);
      setOpciones([{ ...OPCION_VACIA }]);
      recargar();
    });
  }

  if (cargando && !grupos) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Buscando las opciones…
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Opciones</span>

      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}

      {grupos && grupos.length === 0 && !creando ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
          Los extras que hoy se regalan: el punto de cocción, el agregado de queso, la guarnición.
        </p>
      ) : null}

      {grupos && grupos.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
          {grupos.map((grupo) => (
            <li className="flex items-center gap-2 bg-white px-3 py-2.5" key={grupo.id}>
              <button
                aria-pressed={grupo.activo}
                className={`min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition ${
                  grupo.activo ? "text-slate-950" : "text-slate-400"
                }`}
                disabled={guardandoId === grupo.id}
                onClick={() => alternar(grupo)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      grupo.activo ? "border-primary bg-primary text-white" : "border-slate-300"
                    }`}
                  >
                    {grupo.activo ? "✓" : ""}
                  </span>
                  <span className="truncate text-sm font-black">{grupo.name}</span>
                </span>
                <span className="mt-0.5 block pl-6 text-xs font-semibold text-slate-500">
                  {grupo.opciones.length} {grupo.opciones.length === 1 ? "opción" : "opciones"}
                  {grupo.required ? " · obligatorio" : ""}
                </span>
              </button>
              {/* Desplegar y borrar, separados: uno edita el grupo, el otro se
                  lo saca a todo el negocio. */}
              <button
                aria-expanded={abierto === grupo.id}
                aria-label={`Ver las opciones de ${grupo.name}`}
                className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                onClick={() => {
                  setAbierto(abierto === grupo.id ? null : grupo.id);
                  setOpcionSuelta({ ...OPCION_VACIA });
                }}
                type="button"
              >
                <ChevronDown className={`size-4 transition ${abierto === grupo.id ? "rotate-180" : ""}`} />
              </button>
              <button
                aria-label={`Borrar ${grupo.name} de todos los productos`}
                className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                disabled={guardandoId === grupo.id}
                onClick={() => borrar(grupo)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Las opciones del grupo abierto, con su ajuste y su baja. Van afuera de
          la fila para no anidar botones dentro de un botón, que rompe el
          teclado y el lector de pantalla. */}
      {abierto && grupos ? (
        <div className="grid gap-2 rounded-2xl border border-slate-200 p-3">
          {(grupos.find((grupo) => grupo.id === abierto)?.opciones ?? []).map((opcion) => (
            <div className="flex items-center justify-between gap-2" key={opcion.id}>
              <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{opcion.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-xs font-black ${
                    opcion.priceDelta > 0
                      ? "text-emerald-700"
                      : opcion.priceDelta < 0
                        ? "text-rose-600"
                        : "text-slate-400"
                  }`}
                >
                  {opcion.priceDelta === 0
                    ? "sin cargo"
                    : `${opcion.priceDelta > 0 ? "+" : "−"}$${Math.abs(opcion.priceDelta).toLocaleString("es-AR")}`}
                </span>
                <button
                  aria-label={`Sacar ${opcion.name}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  disabled={guardandoId === abierto}
                  onClick={() => sacarOpcion(opcion.id, abierto)}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              onChange={(evento) => setOpcionSuelta((actual) => ({ ...actual, name: evento.target.value }))}
              placeholder="Otra opción"
              value={opcionSuelta.name}
            />
            <button
              aria-label={opcionSuelta.resta ? "Resta al precio" : "Suma al precio"}
              className={`size-9 shrink-0 rounded-xl border font-black transition ${
                opcionSuelta.resta
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => setOpcionSuelta((actual) => ({ ...actual, resta: !actual.resta }))}
              type="button"
            >
              {opcionSuelta.resta ? "−" : "+"}
            </button>
            <input
              aria-label="Cuánto suma o resta"
              className="w-20 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              inputMode="numeric"
              onChange={(evento) =>
                setOpcionSuelta((actual) => ({ ...actual, monto: formatAmountInput(evento.target.value) }))
              }
              placeholder="$0"
              value={opcionSuelta.monto}
            />
            <button
              className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white transition active:scale-95 disabled:opacity-50"
              disabled={guardandoId === abierto || opcionSuelta.name.trim() === ""}
              onClick={() => agregarOpcion(abierto)}
              type="button"
            >
              Agregar
            </button>
          </div>
        </div>
      ) : null}

      {/* Que el borrado sea de todos se dice ACÁ, no solo en el confirm: la
          advertencia que aparece recién al apretar llega tarde para decidir. */}
      {grupos && grupos.length > 0 ? (
        <p className="text-[0.6875rem] text-slate-500">
          El tilde es de este producto. Borrar saca el grupo de todos los que lo tengan.
        </p>
      ) : null}

      {creando ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
          <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
            Nombre del grupo
            <input
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Ej: Punto de cocción"
              value={nombre}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Tilde
              activo={obligatorio}
              ayuda="No se puede agregar sin elegir una."
              onClick={() => setObligatorio(!obligatorio)}
              titulo="Hay que elegir sí o sí"
            />
            <Tilde
              activo={variasJuntas}
              ayuda="Como los agregados de una pizza."
              onClick={() => setVariasJuntas(!variasJuntas)}
              titulo="Puede elegir varias"
            />
          </div>

          <div className="grid gap-2">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Las opciones</span>
            {opciones.map((opcion, indice) => (
              <div className="flex items-center gap-2" key={indice}>
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
                  onChange={(evento) =>
                    setOpciones((actuales) =>
                      actuales.map((item, i) => (i === indice ? { ...item, name: evento.target.value } : item)),
                    )
                  }
                  placeholder="Ej: Jugoso"
                  value={opcion.name}
                />
                {/* El signo aparte del monto: un "sin queso −$300" es tan real
                    como un agregado, y pedirlo con un menos tipeado se presta a
                    que se pierda. */}
                <button
                  aria-label={opcion.resta ? "Resta al precio" : "Suma al precio"}
                  className={`size-10 shrink-0 rounded-2xl border text-lg font-black transition ${
                    opcion.resta
                      ? "border-rose-200 bg-rose-50 text-rose-600"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() =>
                    setOpciones((actuales) =>
                      actuales.map((item, i) => (i === indice ? { ...item, resta: !item.resta } : item)),
                    )
                  }
                  type="button"
                >
                  {opcion.resta ? "−" : "+"}
                </button>
                {/* Input propio y no `MoneyInput`: aquél es no-controlado
                    —guarda el monto en estado interno para los forms con server
                    action— y acá el valor vive en la lista de opciones. Se
                    reusa `formatAmountInput`, así que se tipea igual que en el
                    resto de la app: el punto separa miles. */}
                <input
                  aria-label="Cuánto suma o resta"
                  className="w-24 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
                  inputMode="numeric"
                  onChange={(evento) =>
                    setOpciones((actuales) =>
                      actuales.map((item, i) =>
                        i === indice ? { ...item, monto: formatAmountInput(evento.target.value) } : item,
                      ),
                    )
                  }
                  placeholder="$0"
                  value={opcion.monto}
                />
              </div>
            ))}
            <button
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:border-primary/40 hover:text-primary"
              onClick={() => setOpciones((actuales) => [...actuales, { ...OPCION_VACIA }])}
              type="button"
            >
              <Plus className="size-3.5" />
              Otra opción
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="rounded-2xl px-4 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
              onClick={() => {
                setCreando(false);
                setError(null);
              }}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
              disabled={guardandoId !== null}
              onClick={crear}
              type="button"
            >
              Crear grupo
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:border-primary/40 hover:text-primary"
          onClick={() => setCreando(true)}
          type="button"
        >
          <Plus className="size-4" />
          Nuevo grupo de opciones
        </button>
      )}
    </div>
  );
}

function Tilde({
  titulo,
  ayuda,
  activo,
  onClick,
}: {
  titulo: string;
  ayuda: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={activo}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        activo ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-black text-slate-950">{titulo}</span>
      <span className="mt-0.5 block text-xs font-semibold text-slate-500">{ayuda}</span>
    </button>
  );
}
