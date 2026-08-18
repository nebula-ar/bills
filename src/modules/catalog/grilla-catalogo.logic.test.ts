import { describe, expect, it } from "vitest";

import { QUANTITY_SCALE } from "@/lib/quantity";

import {
  contarCambios,
  margenPct,
  separarCatalogo,
  stockStatusOf,
  totalesDe,
  type FilaConPlata,
  type FilaEditable,
} from "./grilla-catalogo.logic";

/** Una fila de la grilla con lo mínimo, para no repetir siete campos por test. */
function fila(parcial: Partial<FilaConPlata> = {}): FilaConPlata {
  return { stockQuantity: null, minStockRaw: null, cost: null, priceValue: null, ...parcial };
}

/** Unidades a milésimas, para que los tests se lean en unidades. */
const u = (unidades: number) => unidades * QUANTITY_SCALE;

describe("margenPct", () => {
  it("es sobre el PRECIO, no sobre el costo", () => {
    // Comprar a 100 y vender a 200 es 50% acá, no 100%. Es la pregunta del
    // dueño: de cada peso que entra, cuánto le queda.
    expect(margenPct(100, 200)).toBe(50);
  });

  it("el caso real de la pantalla", () => {
    expect(margenPct(3_500, 9_520)).toBe(63);
  });

  it("sin costo no se inventa un margen", () => {
    // Devolver 100% acá diría "ganás todo", que es exactamente lo que NO se
    // sabe. La pantalla muestra "—".
    expect(margenPct(null, 9_520)).toBeNull();
  });

  it("sin precio tampoco", () => {
    expect(margenPct(3_500, null)).toBeNull();
  });

  it("precio cero o negativo no divide", () => {
    expect(margenPct(3_500, 0)).toBeNull();
    expect(margenPct(3_500, -100)).toBeNull();
  });

  it("vender por debajo del costo da margen negativo, no cero", () => {
    // Que se vea el rojo. Recortarlo a cero esconde justo el producto que está
    // haciendo perder plata.
    expect(margenPct(200, 100)).toBe(-100);
  });

  it("costo cero da 100%", () => {
    expect(margenPct(0, 9_520)).toBe(100);
  });
});

describe("stockStatusOf", () => {
  it("sin control de stock devuelve null, que NO es lo mismo que cero", () => {
    // Un corte de pelo no se queda sin existencias. Si esto devolviera "out",
    // la barbería vería toda su lista en rojo pidiendo reposición.
    expect(stockStatusOf({ stockQuantity: null, minStockRaw: null })).toBeNull();
  });

  it("cero o menos es 'out'", () => {
    expect(stockStatusOf({ stockQuantity: 0, minStockRaw: null })).toBe("out");
    expect(stockStatusOf({ stockQuantity: -u(2), minStockRaw: null })).toBe("out");
  });

  it("en el mínimo justo ya es 'low': es cuándo reponer, no cuándo se acabó", () => {
    expect(stockStatusOf({ stockQuantity: u(5), minStockRaw: u(5) })).toBe("low");
  });

  it("una unidad arriba del mínimo ya está bien", () => {
    expect(stockStatusOf({ stockQuantity: u(6), minStockRaw: u(5) })).toBe("ok");
  });

  it("sin mínimo cargado, cualquier existencia positiva está bien", () => {
    expect(stockStatusOf({ stockQuantity: u(1), minStockRaw: null })).toBe("ok");
  });

  it("compara en milésimas, no en unidades", () => {
    // 0,5 kg contra un mínimo de 1 kg. Si se comparara en unidades enteras
    // esto no avisaría nunca en una verdulería.
    expect(stockStatusOf({ stockQuantity: 500, minStockRaw: u(1) })).toBe("low");
  });
});

describe("totalesDe", () => {
  it("multiplica por la existencia, no suma precios sueltos", () => {
    // Es la diferencia entre "cuánto vale un alfajor" y "cuánto tengo en
    // alfajores". El total de arriba de la grilla contesta la segunda.
    const totales = totalesDe([fila({ stockQuantity: u(10), cost: 3_500, priceValue: 9_520 })]);
    expect(totales.costo).toBe(35_000);
    expect(totales.precio).toBe(95_200);
  });

  it("el margen del total es ponderado, no el promedio de los márgenes", () => {
    // Dos productos con márgenes muy distintos y stock muy distinto: el
    // promedio simple daría 50%, pero lo que manda es el que tiene volumen.
    const totales = totalesDe([
      fila({ stockQuantity: u(100), cost: 900, priceValue: 1_000 }), // 10%, mucho stock
      fila({ stockQuantity: u(1), cost: 100, priceValue: 1_000 }), // 90%, casi nada
    ]);
    // costo 90.100 sobre precio 101.000 => 11%, no 50%.
    expect(totales.margen).toBe(11);
  });

  it("un producto SIN costo queda afuera del costo y se avisa", () => {
    // Contarlo como cero abarataría el total e inflaría el margen: diría que se
    // gana más de lo que se gana. Se excluye y se dice cuántos son.
    const totales = totalesDe([
      fila({ stockQuantity: u(10), cost: 3_500, priceValue: 9_520 }),
      fila({ stockQuantity: u(10), cost: null, priceValue: 9_520 }),
    ]);
    expect(totales.sinCosto).toBe(1);
    expect(totales.costo).toBe(35_000);
    // El precio SÍ lo cuenta: el hueco es el costo, no el precio.
    expect(totales.precio).toBe(190_400);
  });

  it("cuenta las filas SIN existencia en el total de productos pero no en conStock", () => {
    const totales = totalesDe([
      fila({ stockQuantity: u(3), cost: 100, priceValue: 200 }),
      fila({ stockQuantity: 0, cost: 100, priceValue: 200 }),
      fila({ stockQuantity: null, cost: 100, priceValue: 200 }),
    ]);
    expect(totales.productos).toBe(3);
    expect(totales.conStock).toBe(1);
  });

  it("porReponer suma los agotados Y los que están en el mínimo", () => {
    const totales = totalesDe([
      fila({ stockQuantity: 0, minStockRaw: u(5) }), // out
      fila({ stockQuantity: u(5), minStockRaw: u(5) }), // low
      fila({ stockQuantity: u(50), minStockRaw: u(5) }), // ok
      fila({ stockQuantity: null, minStockRaw: null }), // servicio: no cuenta
    ]);
    expect(totales.porReponer).toBe(2);
  });

  it("una existencia negativa no resta plata del total", () => {
    // Un saldo negativo es un error de carga, no mercadería que valga menos que
    // nada. Si sumara, taparía el faltante de otro producto.
    const totales = totalesDe([
      fila({ stockQuantity: -u(10), cost: 3_500, priceValue: 9_520 }),
      fila({ stockQuantity: u(10), cost: 3_500, priceValue: 9_520 }),
    ]);
    expect(totales.costo).toBe(35_000);
    expect(totales.conStock).toBe(1);
  });

  it("sin nada cargado no inventa un margen de cero", () => {
    const totales = totalesDe([fila({ stockQuantity: u(10), cost: null, priceValue: null })]);
    expect(totales.margen).toBeNull();
  });

  it("una grilla vacía da todo en cero, sin romperse", () => {
    expect(totalesDe([])).toEqual({
      productos: 0,
      conStock: 0,
      porReponer: 0,
      costo: 0,
      precio: 0,
      margen: null,
      sinCosto: 0,
    });
  });

  it("redondea a peso entero: la plata no tiene centavos", () => {
    // 0,333 kg a $1.000 el kilo da 333,33... y se guarda 333.
    const totales = totalesDe([fila({ stockQuantity: 333, cost: 1_000, priceValue: 1_000 })]);
    expect(Number.isInteger(totales.costo)).toBe(true);
    expect(totales.costo).toBe(333);
  });
});

describe("contarCambios", () => {
  const guardado: FilaEditable = {
    name: "Alfajor de Maicena",
    description: "Con dulce de leche",
    cost: 3_500,
    sku: "ALF-001",
    barcode: null,
    minStockValue: "5",
    idealStockValue: "30",
    kind: "GOOD",
  };
  const config = { available: true, priceValue: "9520" };

  /** El FormData que manda la ficha cuando NO se tocó nada. */
  function fichaIntacta(cambios: Record<string, string> = {}): FormData {
    const datos = new FormData();
    datos.set("name", "Alfajor de Maicena");
    datos.set("price", "9.520");
    datos.set("cost", "3.500");
    datos.set("sku", "ALF-001");
    datos.set("barcode", "");
    datos.set("minStock", "5");
    datos.set("idealStock", "30");
    datos.set("description", "Con dulce de leche");
    datos.set("active", "on");
    for (const [k, v] of Object.entries(cambios)) datos.set(k, v);
    return datos;
  }

  it("sin tocar nada, cero cambios", () => {
    expect(contarCambios(fichaIntacta(), guardado, config)).toBe(0);
  });

  it("el separador de miles no cuenta como cambio", () => {
    // "$ 9.520" y "9520" son el mismo precio. Sin normalizar, abrir la ficha ya
    // decía "2 cambios sin guardar" sin que nadie tocara una tecla.
    expect(contarCambios(fichaIntacta({ price: "9520", cost: "3500" }), guardado, config)).toBe(0);
  });

  it("escribir y borrar deja el contador en cero", () => {
    // No se cuenta "¿tocó una tecla?" sino valor contra valor.
    expect(contarCambios(fichaIntacta({ cost: "3.500" }), guardado, config)).toBe(0);
  });

  it("cuenta un cambio de precio", () => {
    expect(contarCambios(fichaIntacta({ price: "10.000" }), guardado, config)).toBe(1);
  });

  it("suma varios campos", () => {
    const datos = fichaIntacta({ name: "Alfajor Nuevo", cost: "4.000", sku: "ALF-002" });
    expect(contarCambios(datos, guardado, config)).toBe(3);
  });

  it("apagar el switch cuenta: el campo `active` desaparece, no llega 'off'", () => {
    // SyncSwitch no dibuja el input oculto cuando está apagado, así que el
    // ausente ES el apagado. Comparar contra "off" no contaría nunca.
    const datos = fichaIntacta();
    datos.delete("active");
    expect(contarCambios(datos, guardado, config)).toBe(1);
  });

  it("con el switch ya apagado, que no llegue `active` NO es un cambio", () => {
    const datos = fichaIntacta();
    datos.delete("active");
    expect(contarCambios(datos, guardado, { available: false, priceValue: "9520" })).toBe(0);
  });

  it("borrar el SKU cuenta como cambio", () => {
    expect(contarCambios(fichaIntacta({ sku: "" }), guardado, config)).toBe(1);
  });

  it("los espacios de más en la descripción no cuentan", () => {
    expect(contarCambios(fichaIntacta({ description: "  Con dulce de leche  " }), guardado, config)).toBe(0);
  });

  it("un producto sin precio configurado arranca en cero", () => {
    // Sin config, el precio guardado es null. Si el campo también viene vacío,
    // no hay cambio: no puede decir "1 cambio" apenas se abre la ficha.
    const datos = fichaIntacta({ price: "" });
    datos.delete("active");
    const sinPrecio: FilaEditable = { ...guardado, sku: null, barcode: null };
    datos.set("sku", "");
    expect(contarCambios(datos, sinPrecio, null)).toBe(0);
  });

  it("ponerle precio a un producto que no lo tenía cuenta", () => {
    const datos = fichaIntacta({ price: "9.520" });
    datos.delete("active");
    expect(contarCambios(datos, guardado, null)).toBe(1);
  });
});

describe("separarCatalogo", () => {
  const harina = { kind: "INGREDIENT", name: "Harina" };
  const medialuna = { kind: "GOOD", name: "Medialuna" };
  const corte = { kind: "SERVICE", name: "Corte" };

  it("el insumo va a su lado y lo demás al de venta", () => {
    const { vendibles, insumos } = separarCatalogo([medialuna, harina, corte]);

    expect(insumos).toEqual([harina]);
    // Un servicio se vende igual que la mercadería: lo único que separa la
    // pestaña es NO tener precio, y un corte de pelo sí tiene.
    expect(vendibles).toEqual([medialuna, corte]);
  });

  it("respeta el orden en que venían", () => {
    // La grilla ya llega ordenada por nombre desde el servidor; separar no
    // puede reordenar o la lista salta cada vez que se cambia de pestaña.
    const { vendibles } = separarCatalogo([corte, medialuna]);
    expect(vendibles.map((p) => p.name)).toEqual(["Corte", "Medialuna"]);
  });

  it("sin insumos, la lista de insumos queda vacía y no null", () => {
    // El llamador pregunta `insumos.length` para decidir si dibuja las
    // pestañas: un null ahí lo rompe en un negocio sin recetas.
    const { vendibles, insumos } = separarCatalogo([medialuna]);
    expect(insumos).toEqual([]);
    expect(vendibles).toEqual([medialuna]);
  });

  it("una lista vacía no explota", () => {
    expect(separarCatalogo([])).toEqual({ vendibles: [], insumos: [] });
  });
});

describe("contarCambios sobre un insumo", () => {
  // Un insumo arrastra config de sucursal cuando ANTES fue un producto que se
  // vendía y después se lo convirtió. La ficha ya no dibuja ni el precio ni el
  // switch de disponibilidad, así que esos campos no viajan en el FormData.
  const insumo = {
    name: "Harina",
    description: null,
    cost: 1_200,
    sku: null,
    barcode: null,
    minStockValue: "",
    idealStockValue: "",
    kind: "INGREDIENT",
  };

  function formDeInsumo(): FormData {
    const datos = new FormData();
    datos.set("name", "Harina");
    datos.set("cost", "1200");
    datos.set("sku", "");
    datos.set("barcode", "");
    datos.set("minStock", "");
    datos.set("idealStock", "");
    datos.set("description", "");
    return datos;
  }

  it("no inventa cambios por el precio ni la disponibilidad que ya no se editan", () => {
    // Sin este guard el contador decía "2 cambios sin guardar" apenas se abría
    // la ficha y no se iba nunca: la comparación leía "" contra el precio viejo
    // y `false` contra la disponibilidad vieja, y ninguno de los dos se podía
    // tocar desde la pantalla.
    const cambios = contarCambios(formDeInsumo(), insumo, { available: true, priceValue: "3000" });

    expect(cambios).toBe(0);
  });

  it("sigue contando lo que el insumo SÍ edita", () => {
    const datos = formDeInsumo();
    datos.set("cost", "1500");

    expect(contarCambios(datos, insumo, { available: true, priceValue: "3000" })).toBe(1);
  });
});
