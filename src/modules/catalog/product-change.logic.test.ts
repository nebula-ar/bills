import { describe, expect, it } from "vitest";

import { ProductChangeField } from "@/generated/prisma/enums";

import { CAMPOS_DE_PRODUCTO, compararCampo, diffDeProducto } from "./product-change.logic";

describe("compararCampo", () => {
  it("anota el cambio con el valor viejo y el nuevo", () => {
    expect(compararCampo(ProductChangeField.PRICE, 8_900, 9_520)).toEqual({
      field: ProductChangeField.PRICE,
      previous: "8900",
      next: "9520",
    });
  });

  it("guarda el valor CRUDO, no formateado", () => {
    // Formatear al guardar congelaría el formato de hoy: dentro de un año el
    // historial mostraría una moneda o separadores que ya no se usan.
    expect(compararCampo(ProductChangeField.COST, 3_200, 3_500)?.next).toBe("3500");
  });

  it("undefined NO es un cambio", () => {
    // El campo no vino en el formulario —está en otra pestaña, o el rubro no lo
    // usa—. Anotarlo como borrado llenaría el historial de borrados que nunca
    // pasaron. Es el caso que más fácil se cuela.
    expect(compararCampo(ProductChangeField.SKU, "ALF-001", undefined)).toBeNull();
  });

  it("null SÍ es un cambio: lo borraron", () => {
    expect(compararCampo(ProductChangeField.SKU, "ALF-001", null)).toEqual({
      field: ProductChangeField.SKU,
      previous: "ALF-001",
      next: null,
    });
  });

  it("el string vacío cuenta igual que null", () => {
    // Borrar el contenido de un input deja "", no null. Tratarlos distinto
    // anotaría un cambio al volver a guardar sin tocar nada.
    expect(compararCampo(ProductChangeField.SKU, null, "")).toBeNull();
    expect(compararCampo(ProductChangeField.SKU, "", null)).toBeNull();
  });

  it("ignora espacios de más", () => {
    expect(compararCampo(ProductChangeField.NAME, "Alfajor", " Alfajor ")).toBeNull();
  });

  it("no anota nada si el valor es el mismo", () => {
    expect(compararCampo(ProductChangeField.COST, 3_500, 3_500)).toBeNull();
  });

  it("maneja booleanos, para la disponibilidad", () => {
    expect(compararCampo(ProductChangeField.AVAILABILITY, true, false)).toEqual({
      field: ProductChangeField.AVAILABILITY,
      previous: "true",
      next: "false",
    });
  });
});

describe("diffDeProducto", () => {
  it("devuelve solo los campos que cambiaron", () => {
    const cambios = diffDeProducto({
      anterior: { name: "Alfajor", cost: 3_200, sku: "ALF-001" },
      siguiente: { name: "Alfajor", cost: 3_500, sku: "ALF-001" },
      campos: [...CAMPOS_DE_PRODUCTO],
    });

    expect(cambios).toHaveLength(1);
    expect(cambios[0].field).toBe(ProductChangeField.COST);
  });

  it("sin cambios devuelve una lista vacía, no una fila en blanco", () => {
    const cambios = diffDeProducto({
      anterior: { name: "Alfajor", cost: 3_500 },
      siguiente: { name: "Alfajor", cost: 3_500 },
      campos: [...CAMPOS_DE_PRODUCTO],
    });

    expect(cambios).toEqual([]);
  });

  it("no inventa cambios por los campos que no vinieron", () => {
    // Guardar desde la pestaña General no manda minStock ni idealStock: si eso
    // contara como borrado, cada guardado escribiría dos filas falsas.
    const cambios = diffDeProducto({
      anterior: { name: "Alfajor", minStock: 10_000, idealStock: 30_000 },
      siguiente: { name: "Alfajor Nuevo" },
      campos: [...CAMPOS_DE_PRODUCTO],
    });

    expect(cambios).toHaveLength(1);
    expect(cambios[0].field).toBe(ProductChangeField.NAME);
  });
});
