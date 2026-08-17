import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { AppModule, Vertical } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { CONFIGURABLE_MODULES, MODULE_INFO, MODULE_REQUIRES } from "./app-modules";
import { VERTICAL_ORDER, VERTICAL_PRESETS, verticalFeatures } from "./vertical";

// Lo que cada rubro muestra. El caso que motivó estos tests: una verdulería con
// un botón de "modelo con talles" en el catálogo. Además de ruido, es una
// puerta a cargar mal los datos.

describe("verticalFeatures", () => {
  it("los talles son solo de la ropa", () => {
    expect(verticalFeatures(Vertical.CLOTHING).variants).toBe(true);

    for (const vertical of Object.values(Vertical)) {
      if (vertical === Vertical.CLOTHING) continue;
      expect(verticalFeatures(vertical).variants).toBe(false);
    }
  });

  it("un servicio no se escanea ni viene por bulto, pero sí se reserva por link", () => {
    for (const vertical of [Vertical.BARBERSHOP, Vertical.BEAUTY]) {
      expect(verticalFeatures(vertical)).toEqual({
        variants: false,
        barcodes: false,
        packs: false,
        goods: false,
        publicPage: "booking",
      });
    }
  });

  it("el que repone por cajón vende por bulto", () => {
    for (const vertical of [Vertical.KIOSK, Vertical.GROCERY, Vertical.HABERDASHERY, Vertical.HARDWARE]) {
      expect(verticalFeatures(vertical).packs).toBe(true);
      expect(verticalFeatures(vertical).barcodes).toBe(true);
    }
  });

  it("el rubro dice si un ítem nuevo es mercadería o un servicio", () => {
    // De esto depende que un alta quede con control de stock. Cuando se
    // adivinaba mirando si el dueño había tipeado una cantidad, una medialuna
    // cargada sin el número quedaba guardada como servicio y desaparecía del
    // stock y de la ganancia sin avisar.
    for (const vertical of [Vertical.BARBERSHOP, Vertical.BEAUTY]) {
      expect(verticalFeatures(vertical).goods).toBe(false);
    }

    for (const vertical of [
      Vertical.KIOSK,
      Vertical.GROCERY,
      Vertical.HABERDASHERY,
      Vertical.HARDWARE,
      Vertical.CLOTHING,
      Vertical.BAKERY,
      Vertical.GENERAL,
    ]) {
      expect(verticalFeatures(vertical).goods).toBe(true);
    }
  });

  it("la ropa se escanea pero no se vende por bulto", () => {
    expect(verticalFeatures(Vertical.CLOTHING)).toEqual({
      variants: true,
      barcodes: true,
      packs: false,
      goods: true,
      publicPage: "catalog",
    });
  });

  it("la página pública es distinta según lo que el negocio vende", () => {
    // Un turno se reserva; un producto se mira y se pide.
    expect(verticalFeatures(Vertical.BARBERSHOP).publicPage).toBe("booking");
    expect(verticalFeatures(Vertical.BEAUTY).publicPage).toBe("booking");
    expect(verticalFeatures(Vertical.HARDWARE).publicPage).toBe("catalog");
    expect(verticalFeatures(Vertical.HABERDASHERY).publicPage).toBe("catalog");
    // Un kiosco no vende por link: el cliente pasa por la puerta.
    expect(verticalFeatures(Vertical.KIOSK).publicPage).toBeNull();
    expect(verticalFeatures(Vertical.GROCERY).publicPage).toBeNull();
  });

  it("sin saber el rubro, lo mínimo que le sirve a cualquier comercio", () => {
    expect(verticalFeatures(Vertical.GENERAL)).toEqual({
      variants: false,
      barcodes: true,
      packs: false,
      goods: true,
      publicPage: null,
    });
  });
});

describe("presets", () => {
  it("todos los rubros están declarados y ofrecidos", () => {
    const verticals = Object.values(Vertical);

    expect(Object.keys(VERTICAL_PRESETS).sort()).toEqual([...verticals].sort());
    expect([...VERTICAL_ORDER].sort()).toEqual([...verticals].sort());
  });

  it("cada rubro trae su icono, su ejemplo de nombre y sus features", () => {
    for (const vertical of Object.values(Vertical)) {
      const preset = VERTICAL_PRESETS[vertical];

      expect(preset.icon).toMatch(/^solar:/);
      expect(preset.catalogIcon).toMatch(/^solar:/);
      expect(preset.staffIcon).toMatch(/^solar:/);
      expect(preset.namePlaceholder.length).toBeGreaterThan(0);
      expect(preset.features).toBeDefined();
    }
  });

  it("el rubro que no maneja mercadería tampoco sugiere productos con stock", () => {
    // Coherencia: si no se escanea ni hay bultos, el catálogo del rubro es de
    // servicios (más allá de algún producto de reventa).
    const barberia = VERTICAL_PRESETS[Vertical.BARBERSHOP];
    const servicios = barberia.catalog.filter((item) => item.kind === undefined);

    expect(servicios.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pastelería / panadería: el rubro que trae Migas.
//
// Es el primer rubro gastronómico de la app. Lo que lo distingue de los otros
// no es que venda mercadería —eso ya lo hace un kiosco— sino que la venta
// arranca ANTES del cobro: se toma un pedido en una mesa, la cocina lo prepara
// y recién al final se cobra. De ahí los tres módulos nuevos.
// ─────────────────────────────────────────────────────────────────────────────

describe("pastelería", () => {
  it("el rubro existe y trae su preset completo", () => {
    const preset = VERTICAL_PRESETS[Vertical.BAKERY];

    expect(preset).toBeDefined();
    expect(preset.vertical).toBe(Vertical.BAKERY);
    expect(preset.label.length).toBeGreaterThan(0);
    expect(preset.tagline.length).toBeGreaterThan(0);
    // El ejemplo de nombre tiene que sonar a panadería, no a barbería.
    expect(preset.namePlaceholder).toMatch(/panader|pastel|confiter/i);
  });

  it("arranca con los módulos de gastronomía prendidos", () => {
    // Sin mesas y cocina, una panadería con salón no puede laburar el día uno.
    const { modules } = VERTICAL_PRESETS[Vertical.BAKERY];

    expect(modules).toContain(AppModule.TABLES);
    expect(modules).toContain(AppModule.KITCHEN);
    expect(modules).toContain(AppModule.RECIPES);
    // Y lo que cualquier comercio con mercadería necesita.
    expect(modules).toContain(AppModule.STOCK);
    expect(modules).toContain(AppModule.CASH);
  });

  it("vende mercadería: se escanea y se repone por bulto", () => {
    // Una docena de facturas es un bulto. Un corte de pelo no.
    const features = verticalFeatures(Vertical.BAKERY);

    expect(features.barcodes).toBe(true);
    expect(features.packs).toBe(true);
    // Talles no: una medialuna no viene en S/M/L.
    expect(features.variants).toBe(false);
  });

  it("su página pública es un catálogo, no una agenda de turnos", () => {
    // A una panadería le encargás una torta; no reservás un turno.
    expect(verticalFeatures(Vertical.BAKERY).publicPage).toBe("catalog");
  });

  it("el catálogo semilla es de panadería y tiene precios", () => {
    const { catalog, categories } = VERTICAL_PRESETS[Vertical.BAKERY];

    expect(catalog.length).toBeGreaterThan(5);
    expect(categories.length).toBeGreaterThan(2);
    // Todo producto sembrado tiene precio y categoría declarada, si no el alta
    // deja al negocio con un catálogo a medio cargar.
    for (const item of catalog) {
      expect(item.price, item.name).toBeGreaterThan(0);
      expect(categories, `${item.name}: categoría no declarada`).toContain(item.category);
    }
  });
});

describe("módulos de gastronomía", () => {
  it("los tres tienen su metadata para la nav y el onboarding", () => {
    for (const modulo of [AppModule.TABLES, AppModule.KITCHEN, AppModule.RECIPES]) {
      const info = MODULE_INFO[modulo];

      expect(info, modulo).toBeDefined();
      expect(info.label.length, modulo).toBeGreaterThan(0);
      expect(info.hint.length, modulo).toBeGreaterThan(0);
      expect(info.icon, modulo).toMatch(/^solar:/);
    }
  });

  it("la cocina depende de las mesas", () => {
    // El KDS muestra comandas. Sin mesas no hay comanda que mostrar: prender
    // cocina sola dejaría una pantalla vacía para siempre.
    expect(MODULE_REQUIRES[AppModule.KITCHEN]).toBe(AppModule.TABLES);
  });

  it("las recetas dependen del stock", () => {
    // Una receta descuenta ingredientes. Sin stock no hay de dónde descontar.
    expect(MODULE_REQUIRES[AppModule.RECIPES]).toBe(AppModule.STOCK);
  });

  it("se pueden prender y apagar desde configuración", () => {
    for (const modulo of [AppModule.TABLES, AppModule.KITCHEN, AppModule.RECIPES]) {
      expect(CONFIGURABLE_MODULES, modulo).toContain(modulo);
    }
  });
});

// Un negocio que recién arranca no subió ni una foto: lo único que ve en la
// grilla es lo que trajo el catálogo del rubro. No todos los rubros tienen foto
// todavía —declarar una es opcional— pero la que se declara tiene que estar y
// tiene que servir. Ver `productImageSrc`.
describe("fotos del catálogo semilla", () => {
  const CATALOG_IMAGE_DIR = resolve(process.cwd(), "public/catalog/produce");

  const seeded = VERTICAL_ORDER.flatMap((vertical) =>
    VERTICAL_PRESETS[vertical].catalog.map((item) => ({ vertical, item })),
  );

  it("cada foto declarada existe en public/", () => {
    // Un slug con un typo no rompe el build ni el render: devuelve 404 y la
    // grilla queda con el hueco. Este test es el único lugar donde se nota.
    for (const { vertical, item } of seeded) {
      if (!item.catalogSlug) continue;

      const file = resolve(CATALOG_IMAGE_DIR, `${item.catalogSlug}.webp`);
      expect(existsSync(file), `${vertical} · ${item.name}: falta ${item.catalogSlug}.webp`).toBe(true);
    }
  });

  it("cada foto es cuadrada", async () => {
    // La grilla del POS reserva un cuadrado por producto. Una foto apaisada no
    // rompe nada —por eso se coló— pero deja el renglón desparejo contra las
    // que sí lo son, incluidas las que sube el dueño (512x512, ver
    // `saveProductImage`). El bajador tenía `withoutEnlargement`, que con
    // `cover` se niega a agrandar y devolvía 512x400.
    const { default: sharp } = await import("sharp");

    for (const { vertical, item } of seeded) {
      if (!item.catalogSlug) continue;

      const { width, height } = await sharp(resolve(CATALOG_IMAGE_DIR, `${item.catalogSlug}.webp`)).metadata();
      expect(width, `${vertical} · ${item.name}: ${width}x${height}`).toBe(height);
    }
  });
});
