"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Check, ChevronDown, DynamicIcon, Search, X } from "@/components/icons";
import { formatMoney } from "@/components/manager-ui";
import {
  agruparPorSector,
  estadoDeMesa,
  filtrarMesas,
  mesasAbiertas,
  estadoDeNavbar,
  etiquetaDeDestino,
  filtrarPorNombre,
  necesitaBuscador,
  type Destino,
} from "@/modules/sales/pos-navbar.logic";

/**
 * La barra de arriba del mostrador: a dónde va esta venta, cómo está esa mesa,
 * quién la atiende y cuánto lleva.
 *
 * Reemplaza al paso "¿Dónde?" que vivía en el cuerpo. No es solo mudarlo de
 * lugar: ese paso preguntaba entre mostrador, para llevar y mesa, y de esas
 * tres únicamente "mesa" cambia algo aguas abajo —`sale-channel.logic.ts`
 * pregunta `!== TABLE` y el ticket `=== TABLE`; nadie separa mostrador de
 * para-llevar—. Así que la pregunta pasa a ser una pastilla que casi siempre
 * dice "Caja" y no se toca.
 *
 * Los dos desplegables manejan su estado ACÁ adentro a propósito. Este
 * componente vive dentro del POS, que tiene el catálogo entero con su
 * autocomplete de Syncfusion: un `setState` por tecla en el buscador de mesas
 * re-renderizaría todo eso. Es el mismo problema que ya se pagó en la grilla de
 * Productos.
 */

export type MesaDelNavbar = {
  id: string;
  name: string;
  sector: string | null;
  comanda: {
    orderId: string;
    total: number;
    items: number;
    /** Cargados y todavía sin mandar a cocina. */
    pendientes: number;
    staffId: string | null;
    minutosAbierta: number;
  } | null;
};

export function PosNavbar({
  destino,
  onDestino,
  mesas,
  staffs,
  staffId,
  onStaff,
  total,
  pendientes,
  usaSalon,
  staffIcon,
  acciones,
}: {
  destino: Destino;
  onDestino: (destino: Destino) => void;
  mesas: MesaDelNavbar[];
  staffs: { id: string; name: string }[];
  staffId: string | null;
  onStaff: (id: string) => void;
  /** Lo que lleva la venta o la comanda, ya sumado. */
  total: number;
  /** Ítems cargados sin mandar a cocina. */
  pendientes: number;
  /** Sin salón el selector de destino no tiene sentido: todo es caja. */
  usaSalon: boolean;
  /**
   * El ícono de "quién atiende", que lo elige el RUBRO y no esta pantalla: un
   * restaurante piensa en un mozo y una barbería en un peluquero. Sale de
   * `verticalPreset`, igual que en el resto de la app.
   */
  staffIcon?: string;
  /** El menú de tres puntos, que lo arma quien usa esta barra. */
  acciones?: ReactNode;
}) {
  const mesaActual = destino.tipo === "mesa" ? mesas.find((mesa) => mesa.id === destino.tableId) : undefined;
  const estado = estadoDeNavbar({
    destino,
    pendientes,
    minutosAbierta: mesaActual?.comanda?.minutosAbierta ?? null,
  });
  const vendedor = staffs.find((staff) => staff.id === staffId) ?? null;

  // Sin fondo ni sombra propios: la superficie la pone quien lo usa. Adentro
  // del panel del pedido, que ya es una tarjeta blanca, tener la suya lo dejaba
  // como una caja dentro de otra caja.
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {usaSalon ? <SelectorDeDestino destino={destino} mesas={mesas} onElegir={onDestino} /> : null}

      {/* El estado va al lado y no debajo: es contexto de la pastilla, no un
          dato independiente. En Caja no existe y el hueco queda, porque
          rellenarlo con algo inventado es peor. */}
      {estado ? (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${estado.tono === "aviso" ? "bg-amber-500" : "bg-emerald-500"}`}
          />
          <span className={`truncate font-bold ${estado.tono === "aviso" ? "text-amber-700" : "text-slate-500"}`}>
            {estado.texto}
          </span>
        </span>
      ) : null}

      {/* Siempre visible, incluso con un solo empleado.
          Antes se escondía cuando no había nada que ELEGIR, y eso dejaba fuera
          de la vista a quién se le está acreditando la venta. Es el dato del
          que salen las comisiones: verlo no es opcional, elegirlo sí. Con uno
          solo es una etiqueta y no un desplegable, porque un menú de una opción
          promete una decisión que no existe. */}
      {staffs.length > 1 ? (
        <SelectorDeVendedor icono={staffIcon} onElegir={onStaff} seleccionado={vendedor} staffs={staffs} />
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600">
          {staffIcon ? <DynamicIcon className="size-4 shrink-0 opacity-70" name={staffIcon} /> : null}
          <span className="truncate">{vendedor?.name ?? "Sin vendedor"}</span>
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* El total, en chico y en negro.
            Estaba en rosa y a 20px, o sea que era lo más pesado de la barra —y
            es un dato DUPLICADO: el panel del pedido lo muestra al lado, más
            grande y junto al botón de cobrar, que es donde se mira antes de
            tomar la plata. Acá alcanza con que esté a mano para el que está
            cargando y no quiere girar la cabeza. */}
        {/* `data-total`: adentro del panel del pedido se esconde por CSS. Ahí
            el total ya está abajo, grande y pegado al botón de cobrar, que es
            donde se canta. Repetirlo arriba entre las pastillas lo dejaba
            leyéndose como un control más. En mobile, donde no hay panel al
            costado, este es el único y se muestra. */}
        <p data-total className="text-base font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(total)}
        </p>
        {acciones}
      </div>
    </header>
  );
}

/** La pastilla con el destino y su desplegable. */
function SelectorDeDestino({
  destino,
  mesas,
  onElegir,
}: {
  destino: Destino;
  mesas: MesaDelNavbar[];
  onElegir: (destino: Destino) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = filtrarMesas(mesas, busqueda);
  const abiertas = mesasAbiertas(visibles);

  return (
    <Desplegable
      alCerrar={() => setBusqueda("")}
      etiqueta={
        <>
          <span className="truncate">{etiquetaDeDestino(destino)}</span>
          <ChevronDown className="size-4 shrink-0 opacity-70" />
        </>
      }
      titulo="¿Dónde va esta venta?"
    >
      {/* Siempre visible, aunque haya tres mesas.
          Antes aparecía recién pasando las ocho: la pantalla cambiaba de forma
          sola según cuántas mesas hubiera, y eso obliga a volver a aprenderla
          cada vez que el local crece. Un campo de más no molesta; una interfaz
          que se reacomoda sin avisar, sí. */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-primary/40"
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar mesa o sector…"
          value={busqueda}
        />
      </div>

      {/* Caja primero y siempre visible, aunque haya un filtro puesto: es el
          destino por defecto y volver a él tiene que costar un toque, no
          borrar lo que se escribió. */}
      <Opcion
        activa={destino.tipo === "caja"}
        onClick={() => onElegir({ tipo: "caja" })}
        titulo="Caja"
        detalle="Se cobra en el mostrador"
      />
      {/* Lo urgente primero, y REPETIDO abajo en su sector.
          El panel contesta dos preguntas: "¿qué tengo que atender?" y "¿dónde
          está sentado este cliente?". Ordenar solo por sector responde la
          segunda y entierra la primera. Mostrarlas dos veces cuesta unos
          píxeles y resuelve las dos.

          Cuando no hay ninguna abierta el bloque no existe, así que en una
          panadería sin salón esto no se ve nunca. */}
      {abiertas.length > 0 ? (
        <div>
          <Rotulo>Abiertas · {abiertas.length}</Rotulo>
          {abiertas.map((mesa) => {
            const estado = estadoDeMesa(mesa, formatMoney);
            return (
              <Opcion
                activa={destino.tipo === "mesa" && destino.tableId === mesa.id}
                detalle={estado.tipo === "libre" ? undefined : estado.detalle}
                key={`abierta-${mesa.id}`}
                onClick={() => onElegir({ tipo: "mesa", tableId: mesa.id, nombre: mesa.name })}
                sector={mesa.sector}
                titulo={mesa.name}
                tono={estado.tipo}
              />
            );
          })}
        </div>
      ) : null}

      {/* Agrupadas por SECTOR y no por estado.
          El mozo no piensa "mostrame las libres", piensa "voy a la terraza".
          Con las ocupadas arriba había que barrer toda la lista para saber qué
          hay en un sector, que es justo lo que uno mira parado en la puerta.

          El estado no se perdió: bajó a cada fila, que además es donde se puede
          decir CUÁNTO tiene y no solo que está ocupada. */}
      {agruparPorSector(visibles).map(([sector, delSector]) => (
        <div key={sector}>
          <Rotulo>{sector}</Rotulo>
          {delSector.map((mesa) => {
            const estado = estadoDeMesa(mesa, formatMoney);
            return (
              <Opcion
                activa={destino.tipo === "mesa" && destino.tableId === mesa.id}
                // Sin línea de estado cuando está libre. Decir "Libre" nueve
                // veces seguidas es nueve veces la misma palabra sin
                // información; y como la fila queda de UN renglón en vez de
                // dos, las ocupadas sobresalen solas, sin depender del color.
                detalle={estado.tipo === "libre" ? undefined : estado.detalle}
                key={mesa.id}
                onClick={() => onElegir({ tipo: "mesa", tableId: mesa.id, nombre: mesa.name })}
                titulo={mesa.name}
                tono={estado.tipo}
              />
            );
          })}
        </div>
      ))}

      {visibles.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-slate-500">Ninguna mesa con ese nombre.</p>
      ) : null}

      {/* La puerta al tablero completo. Vive acá abajo y no como un botón
          aparte en la barra: es el destino menos frecuente de los tres. */}
      <Link
        className="mt-2 flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        href="/salon"
      >
        Ver el salón
      </Link>
    </Desplegable>
  );
}

/** Quién se lleva esta venta. */
function SelectorDeVendedor({
  seleccionado,
  staffs,
  onElegir,
  icono,
}: {
  seleccionado: { id: string; name: string } | null;
  staffs: { id: string; name: string }[];
  onElegir: (id: string) => void;
  icono?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const conBuscador = necesitaBuscador(staffs.length);
  const visibles = conBuscador ? filtrarPorNombre(staffs, busqueda) : staffs;

  return (
    <Desplegable
      alCerrar={() => setBusqueda("")}
      // Sin nadie elegido la pastilla lo dice y se ve distinta: es el único
      // campo que puede frenar el cobro, y enterarse al apretar "Cobrar" es
      // tarde.
      etiqueta={
        <>
          {icono ? <DynamicIcon className="size-4 shrink-0 opacity-80" name={icono} /> : null}
          <span className="truncate">{seleccionado?.name ?? "¿Quién atiende?"}</span>
          <ChevronDown className="size-4 shrink-0 opacity-70" />
        </>
      }
      tono={seleccionado ? "normal" : "pendiente"}
      titulo="¿Quién atiende?"
    >
      {conBuscador ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-primary/40"
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre…"
            value={busqueda}
          />
        </div>
      ) : null}

      {visibles.map((staff) => (
        <Opcion
          activa={staff.id === seleccionado?.id}
          key={staff.id}
          onClick={() => onElegir(staff.id)}
          titulo={staff.name}
        />
      ))}

      {visibles.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-slate-500">Nadie con ese nombre.</p>
      ) : null}
    </Desplegable>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    // `text-slate-500` y 11px: en `slate-400` a 10px el contraste no llega a AA
    // y es justo el texto que ordena la lista.
    <p className="mt-3 px-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 first:mt-0">
      {children}
    </p>
  );
}

function Opcion({
  activa,
  titulo,
  detalle,
  sector,
  tono,
  onClick,
}: {
  activa: boolean;
  titulo: string;
  detalle?: string;
  /** Solo en el bloque de arriba: sacada de su grupo, la mesa pierde el dónde. */
  sector?: string | null;
  tono?: "libre" | "ocupada" | "pendiente";
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        activa ? "bg-primary/10" : "hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      {/* Ámbar = algo sin mandar a cocina, verde = servida y al día, gris = libre.
          El color va además del texto, no en lugar del texto: quien no
          distingue verde de ámbar tiene que poder leer lo mismo. */}
      {tono ? (
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${
            tono === "pendiente" ? "bg-amber-500" : tono === "ocupada" ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-950">
          {titulo}
          {sector ? <span className="ml-1.5 font-bold text-slate-400">{sector}</span> : null}
        </span>
        {detalle ? <span className="block truncate text-xs text-slate-500">{detalle}</span> : null}
      </span>
      {activa ? <Check className="size-4 shrink-0 text-primary" /> : null}
    </button>
  );
}

/**
 * Una pastilla que abre un panel.
 *
 * Cierra con Escape, con un click afuera y al elegir algo. Sin lo del click
 * afuera, en una tablet el panel se queda abierto tapando el catálogo y hay que
 * buscar la X, que es justo lo que un mostrador apurado no hace.
 */
function Desplegable({
  etiqueta,
  titulo,
  tono = "normal",
  alCerrar,
  children,
}: {
  etiqueta: ReactNode;
  titulo: string;
  tono?: "normal" | "pendiente";
  alCerrar?: () => void;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  function cerrar() {
    setAbierto(false);
    alCerrar?.();
  }

  useEffect(() => {
    if (!abierto) return;

    function afuera(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) cerrar();
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape") cerrar();
    }

    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", escape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <div className="relative" ref={caja}>
      <button
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className={`flex max-w-[12rem] items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-black transition ${
          tono === "pendiente"
            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            : "bg-slate-100 text-slate-900 hover:bg-slate-200"
        }`}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        type="button"
      >
        {etiqueta}
      </button>

      {abierto ? (
        <div
          aria-label={titulo}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-950/10"
          role="dialog"
          // El click de adentro no tiene que llegar al listener de afuera.
          onClick={(evento) => evento.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-sm font-black text-slate-950">{titulo}</p>
            <button
              aria-label="Cerrar"
              className="grid size-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100"
              onClick={cerrar}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
          <div onClick={cerrar}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}
