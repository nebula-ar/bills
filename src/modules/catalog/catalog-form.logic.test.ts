import { describe, expect, it } from "vitest";

import { ProductKind, Unit } from "@/generated/prisma/enums";

import {
  costoPorUnidad,
  kindParaAlta,
  parseCommercialFields,
  parseOptionalString,
  parsePrice,
  parseRequiredString,
  parseWholeAmount,
  quiereConfigurarSucursal,
} from "./catalog-form.logic";

/** Un FormData como el que manda el navegador, sin escribir 10 líneas por test. */
function form(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor);
  return datos;
}

describe("parsePrice", () => {
  it("el punto separa MILES, no decimales", () => {
    // El caso que justifica todo el parser. `Number("28.000")` da 28, así que
    // sin normalizar, un alfajor de veintiocho mil pesos sale a veintiocho.
    expect(parsePrice("28.000")).toBe(28_000);
    expect(parsePrice("1.500.000")).toBe(1_500_000);
  });

  it("acepta el número pelado", () => {
    expect(parsePrice("28000")).toBe(28_000);
  });

  it("ignora espacios de los costados", () => {
    expect(parsePrice("  9520  ")).toBe(9_520);
  });

  it("rechaza el cero: un precio de cero es regalar el producto", () => {
    expect(parsePrice("0")).toBeNull();
  });

  it("rechaza negativos", () => {
    expect(parsePrice("-500")).toBeNull();
  });

  it("rechaza la coma decimal: la plata son enteros en pesos", () => {
    expect(parsePrice("1500,50")).toBeNull();
  });

  it("el punto NO es un decimal ni siquiera cuando lo parece", () => {
    // "1500.50" da 150050, no 1500. Suena a bug y no lo es: el punto separa
    // miles por contrato, y `MoneyInput` corre `formatAmountInput` en cada
    // tecla, que borra todo lo que no sea dígito. Por la pantalla este valor no
    // se puede tipear: el campo muestra "150.050" mientras se escribe.
    //
    // Queda anotado porque la server action es un endpoint público y por ahí sí
    // entra. No es un agujero de seguridad —hay que ser admin del negocio para
    // llegar, y un admin puede poner el precio que quiera— pero si algún día se
    // expone una API para terceros, este es el primer lugar a mirar.
    expect(parsePrice("1500.50")).toBe(150_050);
  });

  it("rechaza texto y vacío", () => {
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("   ")).toBeNull();
  });

  it("rechaza lo que no es string (un archivo en el campo precio)", () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(new File([""], "x.png"))).toBeNull();
  });
});

describe("parseWholeAmount", () => {
  it("entiende el separador de miles igual que el precio", () => {
    expect(parseWholeAmount("3.500")).toBe(3_500);
  });

  it("acepta el cero, al revés que el precio", () => {
    // Un costo de cero es raro pero existe: mercadería bonificada. Un precio de
    // cero es casi siempre un error de tipeo, por eso `parsePrice` lo rechaza.
    expect(parseWholeAmount("0")).toBe(0);
  });

  it("rechaza negativos y decimales", () => {
    expect(parseWholeAmount("-1")).toBeNull();
    expect(parseWholeAmount("10,5")).toBeNull();
  });

  it("rechaza texto", () => {
    expect(parseWholeAmount("gratis")).toBeNull();
  });

  it("el string vacío devuelve 0, no null", () => {
    // Rareza heredada de `Number("") === 0`. No rompe nada porque todos los
    // llamadores preguntan `costRaw ? parseWholeAmount(costRaw) : null` antes,
    // pero queda anotado: si alguien lo llama directo, un campo vacío le va a
    // guardar un costo de cero en vez de "sin costo" — y un costo de cero infla
    // la ganancia igual que un costo faltante.
    expect(parseWholeAmount("")).toBe(0);
  });
});

describe("parseRequiredString", () => {
  it("recorta los espacios", () => {
    expect(parseRequiredString(form({ name: "  Alfajor  " }), "name")).toBe("Alfajor");
  });

  it("vacío o solo espacios es null", () => {
    expect(parseRequiredString(form({ name: "" }), "name")).toBeNull();
    expect(parseRequiredString(form({ name: "   " }), "name")).toBeNull();
  });

  it("un campo que no vino es null", () => {
    expect(parseRequiredString(form({}), "name")).toBeNull();
  });
});

describe("parseOptionalString", () => {
  it("distingue 'no vino' de 'vino vacío': los dos son undefined", () => {
    // Los dos casos colapsan a undefined a propósito, y el llamador decide con
    // `?? null` si eso significa borrar. Es lo que permite que guardar desde la
    // pestaña General no borre el SKU que vive en Inventario.
    expect(parseOptionalString(form({}), "sku")).toBeUndefined();
    expect(parseOptionalString(form({ sku: "  " }), "sku")).toBeUndefined();
  });

  it("recorta", () => {
    expect(parseOptionalString(form({ sku: " ALF-001 " }), "sku")).toBe("ALF-001");
  });
});

describe("parseCommercialFields", () => {
  it("sin el gate devuelve un objeto VACÍO, no campos en null", () => {
    // La diferencia es todo: un `{ sku: null, cost: null }` haría que guardar
    // desde una pantalla que no pregunta esas cosas las borre todas.
    expect(parseCommercialFields(form({ sku: "ALF-001", cost: "3500" }))).toEqual({});
    expect(parseCommercialFields(form({ hasCommercialFields: "false", sku: "ALF-001" }))).toEqual({});
  });

  it("deduce trackStock del tipo, no de un tilde aparte", () => {
    const mercaderia = parseCommercialFields(form({ hasCommercialFields: "true", kind: ProductKind.GOOD }));
    expect(mercaderia.kind).toBe(ProductKind.GOOD);
    expect(mercaderia.trackStock).toBe(true);

    const servicio = parseCommercialFields(form({ hasCommercialFields: "true", kind: ProductKind.SERVICE }));
    expect(servicio.trackStock).toBe(false);
  });

  it("un tipo inválido no se guarda, y tampoco arrastra trackStock", () => {
    // Si `kind` queda undefined, `trackStock` TIENE que quedar undefined
    // también: mandar `trackStock: false` por un valor basura apagaría el
    // control de stock de un producto físico sin que nadie lo pidiera.
    const roto = parseCommercialFields(form({ hasCommercialFields: "true", kind: "BANANA" }));
    expect(roto.kind).toBeUndefined();
    expect(roto.trackStock).toBeUndefined();
  });

  it("una unidad inválida se descarta", () => {
    expect(parseCommercialFields(form({ hasCommercialFields: "true", unit: "PARSEC" })).unit).toBeUndefined();
    expect(parseCommercialFields(form({ hasCommercialFields: "true", unit: Unit.KG })).unit).toBe(Unit.KG);
  });

  it("los stocks se guardan en milésimas", () => {
    const campos = parseCommercialFields(form({ hasCommercialFields: "true", minStock: "5", idealStock: "30" }));
    expect(campos.minStock).toBe(5_000);
    expect(campos.idealStock).toBe(30_000);
  });

  it("el costo entiende el separador de miles", () => {
    expect(parseCommercialFields(form({ hasCommercialFields: "true", cost: "3.500" })).cost).toBe(3_500);
  });

  it("el bulto se cuenta entero: media caja no existe", () => {
    expect(parseCommercialFields(form({ hasCommercialFields: "true", packSize: "12" })).packSize).toBe(12);
    expect(parseCommercialFields(form({ hasCommercialFields: "true", packSize: "1,5" })).packSize).toBeNull();
  });

  it("un campo de texto vacío se guarda como null: lo borraron", () => {
    const campos = parseCommercialFields(form({ hasCommercialFields: "true", sku: "", barcode: "   " }));
    expect(campos.sku).toBeNull();
    expect(campos.barcode).toBeNull();
  });

  it("REGRESIÓN: un stock mínimo fraccionario se pierde en silencio", () => {
    // `parseQuantityInput` rechaza fracciones cuando la unidad no las admite, y
    // su unidad por defecto es UNIT. Acá NUNCA se le pasa la unidad del
    // formulario, así que una verdulería que pone "reponer cuando baje de 1,5
    // kg" recibe null y el mínimo se guarda borrado, sin un solo aviso.
    //
    // El test fija el comportamiento de HOY. Si algún día se le pasa la unidad,
    // este test va a fallar y hay que cambiarlo por 1500 — que es lo correcto.
    const campos = parseCommercialFields(form({ hasCommercialFields: "true", unit: Unit.KG, minStock: "1,5" }));
    expect(campos.unit).toBe(Unit.KG);
    expect(campos.minStock).toBeNull();
  });
});

describe("quiereConfigurarSucursal", () => {
  it("alcanza con haber tipeado un precio, aunque no toque el switch", () => {
    expect(quiereConfigurarSucursal({ configured: false, active: false, priceRaw: "9520" })).toBe(true);
  });

  it("alcanza con el switch prendido", () => {
    expect(quiereConfigurarSucursal({ configured: false, active: true, priceRaw: "" })).toBe(true);
  });

  it("alcanza con que ya estuviera configurado", () => {
    expect(quiereConfigurarSucursal({ configured: true, active: false, priceRaw: "" })).toBe(true);
  });

  it("sin ninguna de las tres, no se toca la sucursal", () => {
    expect(quiereConfigurarSucursal({ configured: false, active: false, priceRaw: "" })).toBe(false);
    expect(quiereConfigurarSucursal({ configured: false, active: false, priceRaw: null })).toBe(false);
  });

  it("un precio de solo espacios no cuenta como intención", () => {
    expect(quiereConfigurarSucursal({ configured: false, active: false, priceRaw: "   " })).toBe(false);
  });
});

describe("kindParaAlta", () => {
  it("el insumo gana sobre todo lo demás", () => {
    // Un insumo NUNCA se vende, así que ni el rubro ni la cantidad inicial
    // pueden convertirlo en mercadería. Si esto se rompe, la harina aparece en
    // el mostrador a la venta.
    expect(kindParaAlta({ esInsumo: true, vendeMercaderia: true, stock: 40_000 })).toBe(
      ProductKind.INGREDIENT,
    );
    expect(kindParaAlta({ esInsumo: true, vendeMercaderia: false, stock: null })).toBe(
      ProductKind.INGREDIENT,
    );
  });

  it("el rubro decide, no si el dueño se acordó de tipear la cantidad", () => {
    // En una panadería una medialuna es mercadería aunque todavía no sepa
    // cuántas tiene.
    expect(kindParaAlta({ esInsumo: false, vendeMercaderia: true, stock: null })).toBe(ProductKind.GOOD);
  });

  it("una cantidad inicial convierte el ítem en mercadería aunque el rubro sea de servicios", () => {
    // El escape hatch: la barbería que además vende shampoo.
    expect(kindParaAlta({ esInsumo: false, vendeMercaderia: false, stock: 12_000 })).toBe(ProductKind.GOOD);
  });

  it("sin rubro de mercadería y sin cantidad, es un servicio", () => {
    expect(kindParaAlta({ esInsumo: false, vendeMercaderia: false, stock: null })).toBe(ProductKind.SERVICE);
    // Cero no es una cantidad: "tengo cero" no dice que sea mercadería.
    expect(kindParaAlta({ esInsumo: false, vendeMercaderia: false, stock: 0 })).toBe(ProductKind.SERVICE);
  });
});

describe("costoPorUnidad", () => {
  it("la bolsa de harina: $30.000 por 25 kg son $1.200 el kilo", () => {
    // El panadero compra por bolsa y la receta cuenta por kilo. La división la
    // hace el sistema porque es donde se cuela el error que después aparece
    // como un margen raro.
    expect(costoPorUnidad({ precioDelBulto: 30_000, cuantoTrae: 25_000 })).toBe(1_200);
  });

  it("redondea a pesos enteros, como toda la plata del sistema", () => {
    // $30.000 / 23 kg = $1.304,34…
    expect(costoPorUnidad({ precioDelBulto: 30_000, cuantoTrae: 23_000 })).toBe(1_304);
  });

  it("una fracción de unidad también divide bien", () => {
    // Medio litro a $500 son $1.000 el litro. Si esto se rompiera, el costo
    // saldría a la mitad y la ganancia inflada.
    expect(costoPorUnidad({ precioDelBulto: 500, cuantoTrae: 500 })).toBe(1_000);
  });

  it("sin precio o sin cuánto trae, no hay costo: null, nunca cero", () => {
    // Un cero acá sería "me sale gratis", que es la mentira más cara que puede
    // decir el sistema: da margen 100% sobre un costo que no se sabe.
    expect(costoPorUnidad({ precioDelBulto: null, cuantoTrae: 25_000 })).toBeNull();
    expect(costoPorUnidad({ precioDelBulto: 30_000, cuantoTrae: null })).toBeNull();
    expect(costoPorUnidad({ precioDelBulto: 30_000, cuantoTrae: 0 })).toBeNull();
  });

  it("acepta el bulto bonificado", () => {
    // Costo cero es raro pero existe, y acá SÍ es un dato: lo pagaste cero.
    expect(costoPorUnidad({ precioDelBulto: 0, cuantoTrae: 25_000 })).toBe(0);
  });
});
