import { Vertical } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

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

  it("la ropa se escanea pero no se vende por bulto", () => {
    expect(verticalFeatures(Vertical.CLOTHING)).toEqual({
      variants: true,
      barcodes: true,
      packs: false,
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
