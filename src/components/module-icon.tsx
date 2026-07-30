"use client";

import "@/lib/icons";

import { Icon } from "@iconify/react";

// Iconify necesita ejecutarse en el cliente, así que las pantallas de servidor
// que muestran un icono elegido en runtime (por nombre) pasan por acá.
export function ModuleIcon({ className = "size-6", name }: { className?: string; name: string }) {
  return <Icon className={className} icon={name} />;
}
