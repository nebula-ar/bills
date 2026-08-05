import { ProductKind, Unit } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import catalogoReal from "./migas-catalog.fixture.json";
import { productoDesdeMigas, unidadDesdeMigas, type ProductoMigas } from "./from-migas";

/**
 * Conversión del catálogo de Migas al modelo de Bills.
 *
 * No es un ejercicio: es lo que decide si la fusión se puede hacer sin perder
 * datos. Las dos diferencias que importan son de FORMATO, no de concepto:
 *
 *   - Migas guarda la plata en `Decimal`; Bills en enteros de PESOS, sin
 *     centavos. Se verificó contra la base que ningún registro usa centavos,
 *     así que la conversión no pierde nada. Este test lo vuelve a comprobar
 *     sobre los 56 productos reales, no sobre ejemplos inventados.
 *   - El precio en Migas vive en el producto; en Bills vive por sucursal
 *     (`BranchProductPrice`), porque el mismo producto puede valer distinto en
 *     Centro que en Palermo.
 *
 * El fixture es el catálogo REAL exportado de la base de Migas. Un test contra
 * datos inventados probaría que mi conversión coincide con mi idea de los
 * datos, que es justamente lo que no hay que asumir.
 */

const REALES = catalogoReal as ProductoMigas[];

describe("el catálogo real entero entra sin perder nada", () => {
  it("los 56 productos convierten", () => {
    expect(REALES.length).toBe(56);

    for (const item of REALES) {
      const { product, price } = productoDesdeMigas(item);

      expect(product.name, item.nombre).toBe(item.nombre);
      expect(price, `${item.nombre}: precio`).toBeGreaterThan(0);
    }
  });

  it("ningún precio pierde centavos", () => {
    // Si esto falla, la fusión NO se puede hacer sin decidir qué hacer con los
    // centavos, y esa es una decisión del negocio, no del código.
    const conCentavos = REALES.filter((p) => !Number.isInteger(p.precio));

    expect(conCentavos.map((p) => `${p.nombre}=${p.precio}`)).toEqual([]);
  });

  it("ningún costo pierde centavos", () => {
    const conCentavos = REALES.filter((p) => p.costo != null && !Number.isInteger(p.costo));

    expect(conCentavos.map((p) => `${p.nombre}=${p.costo}`)).toEqual([]);
  });

  it("toda unidad de Migas existe en Bills", () => {
    // Migas guarda la unidad como texto libre; Bills como enum. Una unidad sin
    // equivalente se convertiría en el default y el producto pasaría a
    // venderse por unidad sin que nadie lo note.
    const unidades = new Set(REALES.map((p) => p.unidad));

    for (const u of unidades) {
      expect(Object.values(Unit), `unidad "${u}" sin equivalente`).toContain(unidadDesdeMigas(u));
    }
  });

  it("todos quedan como mercadería, no como servicio", () => {
    // El default de Bills es SERVICE, porque nació en una barbería. Una
    // medialuna que entra como servicio no descuenta stock ni tiene costo de
    // reposición: el margen del negocio queda mal calculado en silencio.
    for (const item of REALES) {
      expect(productoDesdeMigas(item).product.kind, item.nombre).toBe(ProductKind.GOOD);
    }
  });
});

describe("las unidades", () => {
  it("las que usa el catálogo real mapean a lo suyo", () => {
    expect(unidadDesdeMigas("UNIT")).toBe(Unit.UNIT);
    expect(unidadDesdeMigas("DOZEN")).toBe(Unit.DOZEN);
  });

  it("las que Migas podría tener también", () => {
    expect(unidadDesdeMigas("KG")).toBe(Unit.KG);
    expect(unidadDesdeMigas("GRAM")).toBe(Unit.GRAM);
    expect(unidadDesdeMigas("LITER")).toBe(Unit.LITER);
  });

  it("una unidad desconocida NO cae en el default en silencio", () => {
    // Fallar ruidoso: que aparezca en la migración y no seis meses después,
    // cuando alguien note que el pan se vende por unidad y no por kilo.
    expect(() => unidadDesdeMigas("PARSEC")).toThrow(/PARSEC/);
    expect(() => unidadDesdeMigas("")).toThrow();
  });
});

describe("lo que NO se porta, y por qué", () => {
  it("el emoji no viaja: Bills ya resuelve la foto faltante mejor", () => {
    // Los 56 productos de Migas TIENEN foto, así que el emoji nunca se usó
    // como respaldo. Y Bills muestra la foto genérica del rubro vía
    // catalogSlug: una panadería no fotografía una medialuna, y todas leen el
    // mismo archivo. Portar el emoji sería un segundo respaldo compitiendo.
    const { product } = productoDesdeMigas(REALES[0]);

    expect(product).not.toHaveProperty("emoji");
  });

  it("el precio sale del producto y pasa a ser de la sucursal", () => {
    // En Bills el mismo producto puede valer distinto en cada local. La
    // conversión devuelve el precio aparte justamente para eso.
    const item = REALES.find((p) => p.precio > 0)!;
    const { product, price } = productoDesdeMigas(item);

    expect(product).not.toHaveProperty("price");
    expect(price).toBe(item.precio);
  });
});

describe("los campos que Bills necesita y Migas no tenía", () => {
  it("la mercadería lleva el control de stock prendido", () => {
    // `trackStock` en false haría que vender no descuente nada. En una
    // panadería que ya lleva inventario, eso es perder la mitad del sistema.
    for (const item of REALES.slice(0, 5)) {
      expect(productoDesdeMigas(item).product.trackStock, item.nombre).toBe(true);
    }
  });

  it("el SKU de Migas se conserva", () => {
    const conSku = REALES.find((p) => p.sku)!;

    expect(productoDesdeMigas(conSku).product.sku).toBe(conSku.sku);
  });

  it("un producto dado de baja en Migas no revive", () => {
    const baja: ProductoMigas = { ...REALES[0], activo: false };

    expect(productoDesdeMigas(baja).activo).toBe(false);
  });
});
