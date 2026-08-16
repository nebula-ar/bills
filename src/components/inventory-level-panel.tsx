"use client";

import type { Unit } from "@/generated/prisma/enums";
import { formatQuantity, unitLabel } from "@/lib/quantity";
import { marcaEnEscala, nivelDeInventario } from "@/modules/stock/nivel-inventario.logic";

// Los tres números del inventario de un producto y dónde cae la existencia
// entre ellos.
//
// El medidor no es decoración: "24 unidades" no dice nada sin saber contra qué.
// Puesto en la escala, de un vistazo se ve si está por debajo del punto de
// reposición o si sobra mercadería inmovilizada. El cálculo vive en
// `nivel-inventario.logic.ts` (con tests) porque es la misma decisión que toma
// el badge de la grilla; si se calculara acá, tarde o temprano un lado diría
// "reponer" y el otro no.

export function NivelDeInventarioPanel({
  actual,
  minimo,
  ideal,
  unidad,
  campos,
}: {
  /** Milésimas. null = el producto no lleva control de stock. */
  actual: number | null;
  minimo: number | null;
  ideal: number | null;
  unidad: Unit;
  /**
   * Nombres y valores de los campos del formulario para mínimo e ideal.
   *
   * Las tarjetas que MUESTRAN esos números son también donde se ESCRIBEN. Antes
   * había tarjetas arriba diciendo "Stock mínimo —" y, en otro bloque, unos
   * inputs para cargarlo: el mismo dato en dos lugares, y encima la
   * configuración partía el tab justo entre lo que se mira y lo que se viene a
   * hacer.
   *
   * El stock actual NO se edita acá: sale de los movimientos, y se cambia con
   * las tres acciones de abajo. Un campo de texto invitaría a pisarlo a mano y
   * dejaría el saldo sin el movimiento que lo explica.
   */
  campos?: { minimo: string; ideal: string };
}) {
  const nivel = nivelDeInventario({ actual, minimo, ideal });
  if (nivel.estado === "sin-datos") return null;

  const etiqueta = unitLabel(unidad).toLowerCase();
  const posMinimo = marcaEnEscala(minimo, nivel.tope);
  const posIdeal = marcaEnEscala(ideal, nivel.tope);

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra
          etiqueta="Stock actual"
          tono={nivel.estado === "sin-stock" ? "malo" : nivel.estado === "bajo" ? "aviso" : "normal"}
          unidad={etiqueta}
          valor={actual}
        />
        {/* Los que no están cargados se muestran igual, en gris y con un
            guion: un hueco visible es una invitación a completarlo; una
            tarjeta que desaparece deja creer que ese dato no existe. */}
        <Cifra
          campo={campos ? { name: campos.minimo, placeholder: "Ej: 5" } : undefined}
          etiqueta="Stock mínimo"
          unidad={etiqueta}
          valor={minimo}
        />
        <Cifra
          campo={campos ? { name: campos.ideal, placeholder: "Ej: 30" } : undefined}
          etiqueta="Stock ideal"
          unidad={etiqueta}
          valor={ideal}
        />
      </div>

      {nivel.posicion !== null ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-950/5">
          <p className="text-xs font-bold text-slate-500">Nivel de inventario</p>

          {/* `role="img"` con su descripción: la barra es una imagen de datos.
              Sin esto, con lector de pantalla es un div vacío y la información
              solo existe para quien la ve. */}
          <div
            aria-label={`${formatQuantity(actual as number)} ${etiqueta}${
              minimo !== null ? `, mínimo ${formatQuantity(minimo)}` : ""
            }${ideal !== null ? `, ideal ${formatQuantity(ideal)}` : ""}`}
            className="relative mt-2.5 h-2.5 rounded-full bg-slate-200"
            role="img"
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${
                nivel.estado === "sin-stock"
                  ? "bg-rose-500"
                  : nivel.estado === "bajo"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(2, nivel.posicion * 100)}%` }}
            />
            {posMinimo !== null ? <Marca color="bg-amber-500" posicion={posMinimo} /> : null}
            {posIdeal !== null ? <Marca color="bg-emerald-600" posicion={posIdeal} /> : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] font-semibold text-slate-500">
            {minimo !== null ? <Leyenda color="bg-amber-500" texto="Mínimo" /> : null}
            <Leyenda color="bg-emerald-500" texto="Actual" />
            {ideal !== null ? <Leyenda color="bg-emerald-600" texto="Ideal" /> : null}
          </div>

          {/* Lo accionable, escrito: el medidor muestra la situación, esta
              línea dice qué hacer con ella. */}
          {nivel.faltaParaIdeal !== null && nivel.faltaParaIdeal > 0 ? (
            <p className="mt-2 text-xs font-bold text-slate-600">
              Faltan {formatQuantity(nivel.faltaParaIdeal)} {etiqueta} para llegar al ideal.
            </p>
          ) : null}
          {nivel.estado === "excedido" ? (
            <p className="mt-2 text-xs font-bold text-slate-600">
              Tenés más que el ideal. Es plata inmovilizada.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Cifra({
  etiqueta,
  unidad,
  valor,
  tono = "normal",
  campo,
}: {
  etiqueta: string;
  unidad: string;
  /** Milésimas. null = sin cargar. */
  valor: number | null;
  tono?: "normal" | "aviso" | "malo";
  /** Con esto la tarjeta se escribe; sin esto, solo se lee. */
  campo?: { name: string; placeholder: string };
}) {
  // El input hereda la pinta del número: mismo tamaño y peso, sin caja. Un
  // campo con borde al lado de dos tarjetas de lectura rompería la fila en
  // "dos datos y un formulario", cuando son los tres el mismo tipo de cosa.
  const contenido = campo ? (
    <input
      className="mt-0.5 w-full rounded-lg border border-transparent bg-transparent text-2xl font-black text-slate-950 outline-none transition placeholder:text-slate-300 hover:bg-white focus:border-primary/40 focus:bg-white focus:px-2 focus:ring-4 focus:ring-primary/15"
      defaultValue={valor === null ? "" : formatQuantity(valor)}
      inputMode="decimal"
      name={campo.name}
      placeholder="—"
      style={{ fontVariantNumeric: "tabular-nums" }}
    />
  ) : (
    <p
      className={`mt-0.5 text-2xl font-black ${
        valor === null
          ? "text-slate-300"
          : tono === "malo"
            ? "text-rose-600"
            : tono === "aviso"
              ? "text-amber-700"
              : "text-slate-950"
      }`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {valor === null ? "—" : formatQuantity(valor)}
    </p>
  );

  return (
    <label className="block rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5">
      <span className="block text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      {contenido}
      <span className="block text-[0.6875rem] text-slate-500">
        {valor === null && !campo ? "sin cargar" : unidad}
      </span>
    </label>
  );
}

function Marca({ color, posicion }: { color: string; posicion: number }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full ${color}`}
      style={{ left: `${posicion * 100}%` }}
    />
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
      {texto}
    </span>
  );
}
