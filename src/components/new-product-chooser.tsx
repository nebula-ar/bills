"use client";

import { ChevronRight, Pencil, QrCode } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";

// Primer paso del alta: cómo se va a cargar el producto.
//
// Cargar una caja de mercadería escaneando y cargar un producto suelto a mano
// son dos tareas distintas, y hasta ahora vivían en dos botones separados del
// header ("Escanear" y "Nuevo producto") sin nada que dijera cuál era cuál. El
// que abre la app por primera vez no tiene por qué saber que "Escanear" también
// da de alta: elige "Nuevo producto", que es lo que quiere hacer, y desde ahí se
// le muestran los dos caminos con lo que cada uno le va a costar.
//
// Cuando el rubro no usa códigos de barras no hay nada que elegir, así que el
// selector no aparece: el botón lleva derecho al alta manual. Una pregunta con
// una sola respuesta es un click regalado.

type NewProductChooserProps = {
  open: boolean;
  onClose: () => void;
  // Cómo se dice "producto" en este rubro (servicio, corte, prenda…).
  singular: string;
  onManual: () => void;
  onScan: () => void;
};

export function NewProductChooser({ open, onClose, singular, onManual, onScan }: NewProductChooserProps) {
  // Sheet propio en vez del Dialog de EJ2. Los diálogos EJ2 de esta pantalla
  // quedaban con la instancia en `visible: true` y el nodo en `e-popup-close`
  // —abiertos para el componente, invisibles para el usuario—, y desde ese
  // estado `show()` ya no hace nada porque cree que está abierto. Este sheet es
  // React puro sobre un portal: no hay un widget con estado propio que se pueda
  // desincronizar del de React.
  //
  // De paso es el mismo modal que el resto de la app, así que el primer paso del
  // alta se ve como todo lo demás y no como una pieza de otra librería.
  return (
    <BottomSheet onClose={onClose} open={open} size="dialog">
      <div className="grid gap-3 px-5 pt-2">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Nuevo {singular}</h2>
            <p className="mt-0.5 text-sm text-slate-500">¿Cómo lo querés cargar?</p>
          </div>

          {/* Escanear va primero y con el acento: es el camino rápido cuando el
              producto viene con código, y el que menos se conoce. Buscamos el
              código en la base pública, así que muchas veces el nombre y la
              foto vienen escritos. */}
          <Opcion
            descripcion="Apuntás con la cámara y el nombre y la foto suelen venir solos. Seguido, para cargar varios de una caja."
            destacada
            icono={<QrCode className="size-6" />}
            onClick={onScan}
            titulo="Escanear el código"
          />
          <Opcion
            descripcion="Escribís el nombre, el precio y lo que haga falta. Para lo que hacés vos o no trae código."
            icono={<Pencil className="size-6" />}
            onClick={onManual}
            titulo="Cargarlo a mano"
          />
        </div>
    </BottomSheet>
  );
}

function Opcion({
  descripcion,
  destacada = false,
  icono,
  onClick,
  titulo,
}: {
  descripcion: string;
  destacada?: boolean;
  icono: React.ReactNode;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        destacada
          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
          destacada ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-black text-slate-950">{titulo}</span>
        <span className="mt-0.5 block text-[0.8125rem] leading-snug text-slate-500">{descripcion}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate-400" />
    </button>
  );
}
