import { describe, expect, it } from "vitest";

import { Unit } from "@/generated/prisma/enums";

import { textosDeInsumo } from "./insumo-textos.logic";

describe("textosDeInsumo", () => {
  it("la harina se mide en kilos y el ejemplo es una bolsa de verdad", () => {
    // El caso que justifica todo esto: "Ej: 12" en un campo de kilos no le dice
    // nada al panadero. El ejemplo tiene que ser el número que él tiene delante.
    const kg = textosDeInsumo(Unit.KG);

    expect(kg.cuantoHay).toBe("¿Cuántos kilos tenés?");
    expect(kg.cuantoTrae).toBe("¿Cuántos kilos trae?");
    expect(kg.ejemploBulto).toBe("Ej: 25");
    expect(kg.porUnidad).toBe("el kilo");
  });

  it("el que admite fracciones las muestra en el ejemplo", () => {
    // Un campo que acepta decimales y ejemplifica con un entero esconde que se
    // puede tipear "1,5". El que no las acepta NO puede sugerirlas: el parser
    // devuelve null y la cantidad se pierde en silencio.
    expect(textosDeInsumo(Unit.KG).ejemploCantidad).toContain(",");
    expect(textosDeInsumo(Unit.LITER).ejemploCantidad).toContain(",");
    expect(textosDeInsumo(Unit.UNIT).ejemploCantidad).not.toContain(",");
    expect(textosDeInsumo(Unit.DOZEN).ejemploCantidad).not.toContain(",");
  });

  it("los huevos se cuentan, no se pesan", () => {
    const unidad = textosDeInsumo(Unit.UNIT);

    expect(unidad.cuantoHay).toBe("¿Cuántas unidades tenés?");
    expect(unidad.porUnidad).toBe("la unidad");
  });

  it("el litro y el gramo tienen su propio idioma", () => {
    expect(textosDeInsumo(Unit.LITER).cuantoHay).toBe("¿Cuántos litros tenés?");
    expect(textosDeInsumo(Unit.LITER).porUnidad).toBe("el litro");
    expect(textosDeInsumo(Unit.GRAM).cuantoHay).toBe("¿Cuántos gramos tenés?");
    expect(textosDeInsumo(Unit.GRAM).ejemploBulto).toBe("Ej: 500");
  });

  it("toda unidad tiene textos: ninguna cae en un undefined en pantalla", () => {
    // Si mañana se agrega una unidad al enum y nadie toca esto, el usuario ve
    // "undefined" en el label. El test lo caza antes.
    for (const unit of Object.values(Unit)) {
      const textos = textosDeInsumo(unit);
      expect(textos.cuantoHay).toMatch(/^¿Cuánt/);
      expect(textos.cuantoTrae).toMatch(/^¿Cuánt/);
      expect(textos.ejemploCantidad).toMatch(/^Ej: /);
      expect(textos.ejemploBulto).toMatch(/^Ej: /);
      expect(textos.porUnidad.length).toBeGreaterThan(0);
    }
  });
});
