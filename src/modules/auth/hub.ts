import type { Capability } from "@/lib/capabilities";

/**
 * Los destinos de la pantalla "¿qué querés hacer?", según lo que puede hacer
 * quien acaba de entrar.
 *
 * Antes eran dos tarjetas fijas, porque el único usuario posible era el dueño.
 * Con los roles operativos eso se rompió de la peor manera: `/` mandaba al hub
 * a cualquiera con sesión y el hub exigía ser admin, así que un cajero
 * rebotaba entre las dos rutas para siempre. La pantalla quedaba trabada en su
 * esqueleto, sin un solo error en el log del servidor.
 *
 * Devolver lista vacía es un estado VÁLIDO: hay roles cuyas pantallas todavía
 * no existen. El hub tiene que saber decir "no tenés nada acá" en vez de
 * escapar redirigiendo, que es como se armó el rebote.
 */
export type DestinoDelHub = {
  href: string;
  label: string;
  hint: string;
  cap: Capability;
};

// Solo rutas que EXISTEN. Salón y cocina entran cuando estén sus pantallas:
// ofrecer un link a una ruta que no está es peor que no ofrecer nada.
const DESTINOS: DestinoDelHub[] = [
  {
    href: "/dashboard",
    label: "Panel",
    hint: "Ventas, caja, stock y reportes.",
    cap: "viewReports",
  },
  {
    href: "/pos",
    label: "Vender",
    hint: "Cobrás en el mostrador.",
    cap: "sell",
  },
];

export function destinosDelHub(capacidades: readonly Capability[]): DestinoDelHub[] {
  return DESTINOS.filter((d) => capacidades.includes(d.cap));
}
