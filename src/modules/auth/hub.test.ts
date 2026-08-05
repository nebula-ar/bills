import { UserRole } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { capabilitiesOf } from "@/lib/capabilities";

import { destinosDelHub } from "./hub";

/**
 * La primera pantalla después de entrar: "¿qué querés hacer?".
 *
 * Nació para el dueño de un comercio chico, que usa la app para dos cosas que
 * no se parecen —mirar cómo va el negocio y cobrar en el mostrador—. Con un
 * solo tipo de usuario alcanzaba con dos tarjetas fijas.
 *
 * Con los roles operativos dejó de alcanzar, y de la peor manera: `/` mandaba
 * acá a cualquiera con sesión, y acá se exigía ser admin, así que un cajero
 * rebotaba entre las dos rutas para siempre. La pantalla quedaba trabada en su
 * esqueleto de carga, sin un solo error en el log.
 */

const destinosDe = (rol: UserRole) => destinosDelHub(capabilitiesOf(rol)).map((d) => d.href);

describe("qué le ofrece el hub a cada uno", () => {
  it("el dueño elige entre mirar el negocio y vender", () => {
    expect(destinosDe(UserRole.OWNER)).toEqual(["/dashboard", "/pos"]);
  });

  it("el encargado también", () => {
    expect(destinosDe(UserRole.MANAGER)).toEqual(["/dashboard", "/pos"]);
  });

  it("el cajero solo vende: el panel son los números del negocio", () => {
    expect(destinosDe(UserRole.CASHIER)).toEqual(["/pos"]);
  });
});

describe("los que todavía no tienen a dónde ir", () => {
  it("el mozo y el cocinero no reciben ningún destino", () => {
    // Sus pantallas (salón y cocina) todavía no existen. Devolver lista vacía
    // es lo honesto; ofrecerles un link a una ruta que no está sería peor.
    expect(destinosDe(UserRole.WAITER)).toEqual([]);
    expect(destinosDe(UserRole.COOK)).toEqual([]);
  });

  it("pero eso NO puede volver a ser un rebote", () => {
    // La regla que importa: el hub tiene que poder decir "no tenés nada acá".
    // Que la lista sea vacía es un estado válido, no un error del que haya que
    // escapar redirigiendo.
    expect(() => destinosDelHub(capabilitiesOf(UserRole.COOK))).not.toThrow();
    expect(destinosDelHub([])).toEqual([]);
  });
});

describe("cada destino se explica solo", () => {
  it("trae etiqueta y descripción, no solo la ruta", () => {
    for (const destino of destinosDelHub(capabilitiesOf(UserRole.OWNER))) {
      expect(destino.label.length, destino.href).toBeGreaterThan(0);
      expect(destino.hint.length, destino.href).toBeGreaterThan(0);
    }
  });

  it("ningún destino apunta a una ruta que no exista todavía", () => {
    // Salón y cocina se agregan cuando sus pantallas estén, no antes.
    const rutas = destinosDelHub(capabilitiesOf(UserRole.OWNER)).map((d) => d.href);

    expect(rutas).not.toContain("/salon");
    expect(rutas).not.toContain("/cocina");
  });
});
