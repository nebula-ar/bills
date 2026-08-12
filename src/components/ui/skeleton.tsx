import * as React from "react"

import { cn } from "@/lib/utils"

// Skeleton base del design system, reemplaza los `animate-pulse bg-slate-*`
// sueltos que había por la app.
//
// - Color por token (`muted-foreground/15`): se adapta al rubro y al modo
//   oscuro, en vez de un gris hardcodeado que no cambia con nada.
// - Animación: barrido de shimmer (1.6s ease-in-out) en vez del pulse de
//   opacidad; se lee como "cargando" sin parpadear.
// - prefers-reduced-motion: la regla global de globals.css anula la animación
//   y queda el bloque estático. No hace falta nada acá.
// - A11y: `aria-hidden` para que los lectores de pantalla no anuncien un
//   montón de bloques vacíos.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative select-none overflow-hidden rounded-md bg-muted-foreground/15 dark:bg-muted-foreground/20",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
    </div>
  )
}

export { Skeleton }
