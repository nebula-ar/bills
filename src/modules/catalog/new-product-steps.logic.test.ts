import { describe, expect, it } from "vitest";

import { newProductSteps, puedeAvanzar, type NewProductStepId } from "./new-product-steps.logic";

const base = {
  features: { barcodes: true, stock: true },
  hasCategories: true,
  catalogSingular: "Producto",
  branchName: null,
};

const ids = (input: Parameters<typeof newProductSteps>[0]): NewProductStepId[] =>
  newProductSteps(input).map((step) => step.id);

describe("newProductSteps", () => {
  it("siempre arranca por la identidad y termina juntando todo antes de crear", () => {
    const steps = newProductSteps(base);

    expect(steps[0].id).toBe("identidad");
    // Lo que fuerza el arreglo: la foto es un PASO del alta, no algo que pasa
    // después de haber grabado el producto a medias.
    expect(ids(base)).toContain("foto");
  });

  it("una barbería no tiene código de barras ni existencias que cargar", () => {
    const servicios = ids({ ...base, features: { barcodes: false, stock: false } });

    expect(servicios).not.toContain("codigo");
    expect(servicios).not.toContain("existencia");
    // Preguntarle a un corte de pelo por su código de barras es invitar a
    // inventar un dato que después ensucia el catálogo.
    expect(servicios).toEqual(["identidad", "foto", "precio", "categoria"]);
  });

  it("un kiosco carga existencia y código", () => {
    expect(ids(base)).toEqual(["identidad", "foto", "precio", "existencia", "codigo", "categoria"]);
  });

  it("un insumo tampoco pasa por la categoría", () => {
    // Las categorías del sistema son de VENTA: agrupan la carta pública y son
    // el blanco de las promociones, y un insumo está excluido de las dos. En
    // una panadería las opciones son Panes, Facturas, Bebidas y Pastelería:
    // ofrecerle cuatro respuestas que están todas mal es invitar a cargar mal
    // el dato.
    expect(ids({ ...base, esInsumo: true })).not.toContain("categoria");
  });

  it("un insumo no pasa por el paso del precio", () => {
    // Un insumo NUNCA se vende, así que preguntarle a cuánto sale es invitar a
    // cargar un precio que después lo deja vendible en el mostrador.
    const insumo = ids({ ...base, esInsumo: true });

    expect(insumo).not.toContain("precio");
    // El resto se sigue preguntando: la harina se compra, se guarda y se cuenta.
    expect(insumo).toEqual(["identidad", "foto", "existencia", "codigo"]);
  });

  it("sin categorías cargadas no se pregunta por categoría", () => {
    expect(ids({ ...base, hasCategories: false })).not.toContain("categoria");
  });

  it("el precio nombra la sucursal sólo cuando hay más de una", () => {
    const conSucursal = newProductSteps({ ...base, branchName: "Centro" });
    const sinSucursal = newProductSteps(base);

    expect(conSucursal.find((step) => step.id === "precio")?.title).toContain("Centro");
    expect(sinSucursal.find((step) => step.id === "precio")?.title).not.toContain("Centro");
  });

  it("el título usa la palabra del rubro, no 'producto' siempre", () => {
    const [primero] = newProductSteps({ ...base, catalogSingular: "Servicio" });

    expect(primero.title).toContain("servicio");
  });

  it("sólo la identidad es obligatoria: el resto se puede saltear", () => {
    const steps = newProductSteps(base);

    expect(steps.filter((step) => !step.optional).map((step) => step.id)).toEqual(["identidad"]);
  });
});

describe("puedeAvanzar", () => {
  const [identidad, foto] = newProductSteps(base);

  it("sin nombre no se sale del primer paso", () => {
    expect(puedeAvanzar(identidad, "")).toBe(false);
    expect(puedeAvanzar(identidad, "   ")).toBe(false);
    expect(puedeAvanzar(identidad, "Medialuna")).toBe(true);
  });

  it("los pasos opcionales se pasan vacíos", () => {
    expect(puedeAvanzar(foto, "")).toBe(true);
  });
});
