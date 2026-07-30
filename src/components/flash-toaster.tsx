"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Escucha los flash que las server actions dejan en la URL (?status=&message=),
// los muestra como toast unificado (sonner) y LIMPIA la URL para que el mensaje
// no persista al refrescar ni al compartir el link. Reemplaza los banners que
// cada página renderizaba a mano.
export function FlashToaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const lastShown = useRef<string | null>(null);

  const status = searchParams.get("status");
  const message = searchParams.get("message");

  useEffect(() => {
    if (!message || (status !== "success" && status !== "error")) return;

    // Evita re-disparar el mismo toast si el efecto corre de nuevo.
    const signature = `${status}:${message}`;
    if (lastShown.current === signature) return;
    lastShown.current = signature;

    if (status === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }

    // Sacamos status/message de la URL preservando el resto de los params.
    //
    // Con `history.replaceState` y NO con `router.replace`: la acción que dejó el
    // flash acaba de mutar datos y la pantalla ya se renderizó con los nuevos.
    // Un `router.replace` dispara una navegación que puede volver a servir la
    // copia cacheada de ANTES de la mutación, y el usuario ve su cambio
    // desaparecer. Acá solo queremos limpiar la barra de direcciones.
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("message");
    const query = next.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [status, message, pathname, searchParams]);

  return null;
}
