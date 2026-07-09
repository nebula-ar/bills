"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Escucha los flash que las server actions dejan en la URL (?status=&message=),
// los muestra como toast unificado (sonner) y LIMPIA la URL para que el mensaje
// no persista al refrescar ni al compartir el link. Reemplaza los banners que
// cada página renderizaba a mano.
export function FlashToaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("message");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [status, message, pathname, router, searchParams]);

  return null;
}
