"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Check, ChevronDown } from "@/components/icons";

/**
 * Desplegable propio, con la lista dibujada por nosotros.
 *
 * Un `<select>` nativo se puede maquillar por fuera —`appearance-none` y una
 * flecha nuestra— pero la lista que se abre la dibuja el sistema operativo:
 * esquinas rectas, resaltado azul, tipografía del sistema. No hay CSS que la
 * toque. Para que abierto se vea como el resto de la app hay que hacer el panel
 * a mano.
 *
 * Sigue funcionando dentro de un <form> porque el valor viaja en un input
 * oculto: para el servidor esto es un campo más.
 */

export type SelectOption = { value: string; label: string };

// Dos tamaños y no un `className` libre: los desplegables que viven dentro de
// una fila de tabla (comisiones, promociones) no entran con el alto del campo
// de un formulario, y dejar pasar clases sueltas termina en veinte variantes
// distintas del mismo control.
const TAMANOS = {
  md: { boton: "rounded-2xl px-4 py-3.5 text-base", opcion: "rounded-xl px-3 py-2.5 text-sm", alto: 44 },
  sm: { boton: "rounded-lg px-2.5 py-1.5 text-xs", opcion: "rounded-lg px-2.5 py-2 text-xs", alto: 36 },
} as const;

export function SelectField({
  name,
  defaultValue,
  options,
  ariaLabel,
  onChange,
  size = "md",
}: {
  name?: string;
  defaultValue?: string;
  options: SelectOption[];
  ariaLabel?: string;
  onChange?: (value: string) => void;
  size?: keyof typeof TAMANOS;
}) {
  const tamano = TAMANOS[size];
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const [open, setOpen] = useState(false);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const elegida = options.find((option) => option.value === value) ?? options[0];

  // El panel va en un portal con posición fija: adentro del modal hay un
  // contenedor con `overflow-y-auto` que recortaría una lista absoluta apenas
  // pase el borde de abajo, justo en los campos del final.
  useLayoutEffect(() => {
    if (!open || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const altoEstimado = Math.min(options.length * tamano.alto + 12, 280);
    // Si abajo no entra, se abre hacia arriba en vez de quedar cortado.
    const arriba = r.bottom + altoEstimado > window.innerHeight && r.top > altoEstimado;
    setCaja({ top: arriba ? r.top : r.bottom + 6, left: r.left, width: r.width, arriba });
  }, [open, options.length, tamano.alto]);

  useEffect(() => {
    if (!open) return;

    function afuera(evento: MouseEvent) {
      const destino = evento.target as Node;
      if (botonRef.current?.contains(destino) || panelRef.current?.contains(destino)) return;
      setOpen(false);
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setOpen(false);
    }
    // Al scrollear, el panel fijo se quedaría flotando lejos de su campo. Se
    // cierra en vez de perseguirlo en cada cuadro.
    function cerrar() {
      setOpen(false);
    }

    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [open]);

  function elegir(nuevo: string) {
    setValue(nuevo);
    setOpen(false);
    onChange?.(nuevo);
    botonRef.current?.focus();
  }

  return (
    <>
      {name ? <input name={name} type="hidden" value={value} /> : null}

      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`flex w-full min-w-0 items-center justify-between gap-2 border bg-slate-50 text-left font-semibold text-slate-950 outline-none transition ${tamano.boton} ${
          open ? "border-primary/40 bg-white ring-4 ring-primary/15" : "border-slate-200"
        }`}
        onClick={() => setOpen((abierto) => !abierto)}
        ref={botonRef}
        type="button"
      >
        <span className="min-w-0 truncate">{elegida?.label ?? ""}</span>
        <ChevronDown className={`size-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && caja
        ? createPortal(
            <div
              className="fixed z-[80] max-h-[280px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl duration-150 animate-in fade-in zoom-in-95"
              ref={panelRef}
              role="listbox"
              style={{
                top: caja.arriba ? undefined : caja.top,
                bottom: caja.arriba ? window.innerHeight - caja.top + 6 : undefined,
                left: caja.left,
                width: caja.width,
              }}
            >
              {options.map((option) => {
                const activa = option.value === value;
                return (
                  <button
                    aria-selected={activa}
                    className={`flex w-full items-center gap-2.5 text-left font-bold transition ${tamano.opcion} ${
                      activa ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    key={option.value}
                    onClick={() => elegir(option.value)}
                    role="option"
                    type="button"
                  >
                    {/* La marca ocupa lugar siempre, elegida o no: si apareciera
                        solo en la activa, los textos se correrían al cambiar de
                        opción. */}
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                        activa ? "border-primary bg-primary text-white" : "border-slate-300"
                      }`}
                    >
                      {activa ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
