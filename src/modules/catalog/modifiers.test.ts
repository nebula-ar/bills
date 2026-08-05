import { describe, expect, it } from "vitest";

import {
  effectiveUnitPrice,
  modifiersDelta,
  normalizeGroupSelection,
  validarSeleccion,
  validateGroupConfig,
  type GrupoConModificadores,
} from "./modifiers";

/**
 * Opciones de producto: "con leche descremada", "sin azúcar", "extra jamón".
 *
 * La parte que importa acá NO es la matemática, es la validación. En Migas
 * esto ya falló una vez: la selección se guardaba sin comprobar que el
 * modificador perteneciera a un grupo ASIGNADO A ESE PRODUCTO. Con el link
 * público del QR en la mano, un cliente podía colgarle a su café un
 * "sin jamón −$500" de otro producto, repetirlo, y dejar su cuenta en cero.
 *
 * Por eso acá la validación es UNA función que recibe los grupos del producto
 * y la selección entera. Que la pertenencia sea un chequeo suelto en la server
 * action es exactamente cómo se olvida.
 */

const CAFE: GrupoConModificadores[] = [
  {
    id: "g-leche",
    name: "Tipo de leche",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    modifiers: [
      { id: "m-entera", name: "Entera", priceDelta: 0 },
      { id: "m-descremada", name: "Descremada", priceDelta: 0 },
      { id: "m-almendras", name: "De almendras", priceDelta: 800 },
    ],
  },
  {
    id: "g-extras",
    name: "Extras",
    required: false,
    minSelect: 0,
    maxSelect: 2,
    modifiers: [
      { id: "m-shot", name: "Shot extra", priceDelta: 1200 },
      { id: "m-canela", name: "Canela", priceDelta: 0 },
      { id: "m-crema", name: "Crema", priceDelta: 900 },
    ],
  },
];

describe("la plata", () => {
  it("suma los ajustes elegidos", () => {
    expect(modifiersDelta([{ priceDelta: 800 }, { priceDelta: 1200 }])).toBe(2000);
  });

  it("es matemática entera: no aparecen centavos de la nada", () => {
    // Bills trabaja en pesos enteros. Si esto devolviera decimales, el total
    // de la venta dejaría de coincidir con la suma de sus renglones.
    const precio = effectiveUnitPrice(5290, [{ priceDelta: 800 }, { priceDelta: 900 }]);

    expect(Number.isInteger(precio)).toBe(true);
    expect(precio).toBe(6990);
  });

  it("un ajuste negativo baja el precio, pero NUNCA por debajo de cero", () => {
    // El agujero de Migas: sin piso, un modificador negativo repetido dejaba
    // la línea en negativo y arrastraba el total de la comanda a cero.
    expect(effectiveUnitPrice(1000, [{ priceDelta: -300 }])).toBe(700);

    expect(effectiveUnitPrice(1000, [{ priceDelta: -5000 }])).toBe(0);
    expect(
      effectiveUnitPrice(1000, [{ priceDelta: -900 }, { priceDelta: -900 }]),
    ).toBe(0);
  });
});

describe("la validación: lo que la hace segura", () => {
  it("acepta una selección legítima", () => {
    expect(validarSeleccion(CAFE, ["m-descremada", "m-canela"])).toBeNull();
  });

  it("RECHAZA un modificador que no pertenece al producto", () => {
    // El caso que nos mordió. "m-sin-jamon" existe en el negocio pero es de
    // otro producto: no está en NINGÚN grupo de este café.
    const error = validarSeleccion(CAFE, ["m-descremada", "m-sin-jamon"]);

    expect(error).toBeTruthy();
    expect(error).toMatch(/no (corresponde|pertenece)/i);
  });

  it("rechaza aunque el modificador ajeno venga mezclado con válidos", () => {
    // Colarlo entre opciones legítimas es justamente cómo se intentaría.
    expect(validarSeleccion(CAFE, ["m-entera", "m-canela", "m-inventado"])).toBeTruthy();
  });

  it("exige los grupos obligatorios", () => {
    // Sin leche elegida, el café no se puede preparar: la cocina recibiría una
    // comanda que no sabe cómo hacer.
    const error = validarSeleccion(CAFE, ["m-canela"]);

    expect(error).toMatch(/Tipo de leche/);
  });

  it("respeta el máximo de cada grupo", () => {
    // Dos extras entran; tres no.
    expect(validarSeleccion(CAFE, ["m-entera", "m-shot", "m-canela"])).toBeNull();
    expect(validarSeleccion(CAFE, ["m-entera", "m-shot", "m-canela", "m-crema"])).toMatch(/Extras/);
  });

  it("no deja elegir dos de un grupo que admite una", () => {
    expect(validarSeleccion(CAFE, ["m-entera", "m-descremada"])).toMatch(/Tipo de leche/);
  });

  it("un producto sin grupos no acepta ningún modificador", () => {
    // Una medialuna no tiene opciones. Mandarle una es un pedido armado a mano.
    expect(validarSeleccion([], [])).toBeNull();
    expect(validarSeleccion([], ["m-descremada"])).toBeTruthy();
  });

  it("el mismo modificador repetido no burla el máximo", () => {
    // Mandar ["m-shot","m-shot","m-shot"] es la forma obvia de intentar
    // multiplicar un ajuste negativo.
    expect(validarSeleccion(CAFE, ["m-entera", "m-shot", "m-shot", "m-shot"])).toBeTruthy();
  });
});

describe("configurar un grupo", () => {
  it("un grupo sin nombre no sirve", () => {
    expect(validateGroupConfig({ name: "   " })).toMatch(/nombre/i);
  });

  it("el mínimo no puede superar al máximo", () => {
    expect(validateGroupConfig({ name: "Leche", minSelect: 3, maxSelect: 1 })).toBeTruthy();
  });

  it("un grupo obligatorio exige al menos uno, aunque digan que cero", () => {
    // Si no, queda un grupo "obligatorio" que se puede saltear: la etiqueta
    // dice una cosa y la regla hace otra.
    expect(normalizeGroupSelection({ required: true, minSelect: 0, maxSelect: 2 })).toEqual({
      minSelect: 1,
      maxSelect: 2,
    });
  });

  it("normaliza números rotos en vez de propagarlos", () => {
    expect(normalizeGroupSelection({ required: false, minSelect: -5, maxSelect: 0 })).toEqual({
      minSelect: 0,
      maxSelect: 1,
    });
  });
});
