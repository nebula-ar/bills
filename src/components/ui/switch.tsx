"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Switch reutilizable estilo iOS.
 *
 * Proporciones pensadas para mobile: pista de 48×28 (aspecto 1.7:1) con thumb
 * de 24px que llena la altura — sin el "achatado" que producían los tracks casi
 * cuadrados (h-11 w-12) con thumb chico flotando adentro.
 *
 * Accesibilidad: Radix expone `role="switch"` + `aria-checked`, soporte de
 * teclado (Space/Enter) y estado `data-[state=checked]`; el foco se marca con
 * ring del token del design system. Color checked por defecto: `bg-primary`; se
 * puede sobreescribir desde el call site (ej. `data-[state=checked]:bg-emerald-500`).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-300",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
