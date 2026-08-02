import { describe, expect, it } from "vitest";

import {
  landingFaqs,
  landingFeatures,
  landingHero,
  landingPlans,
  landingTestimonials,
  rubroExamples,
} from "./landing-content";

const allCopy = JSON.stringify({
  landingHero,
  landingFeatures,
  landingFaqs,
  landingPlans,
  landingTestimonials,
  rubroExamples,
});

describe("contenido de la landing generalista", () => {
  it("presenta Bills como gestión para cualquier negocio", () => {
    expect(landingHero.title).toBe("Gestioná tu negocio, no un Excel.");
    expect(landingHero.description).toContain("Ventas, caja, stock y clientes");
    expect(rubroExamples.map((rubro) => rubro.id)).toEqual([
      "barberia",
      "kiosco",
      "tienda",
      "servicios",
    ]);
  });

  it("explica el flujo registrar, ordenar y decidir", () => {
    expect(landingFeatures.map((feature) => feature.kicker)).toEqual([
      "01 / REGISTRÁ",
      "02 / ORDENÁ",
      "03 / DECIDÍ",
    ]);
  });

  it("mantiene precios y preguntas frecuentes independientes del rubro", () => {
    expect(landingPlans).toHaveLength(3);
    expect(landingPlans.every((plan) => plan.features.length > 0)).toBe(true);
    expect(landingFaqs.some((faq) => faq.q.includes("rubro"))).toBe(true);
  });

  it("no usa la barbería como identidad de toda la marca", () => {
    expect(allCopy).not.toMatch(/barber bills|llenar sillas|cobro en la silla|\bbarbero\b/iu);
  });
});


describe("ejemplos de rubro", () => {
  it("cambia el ejemplo sin cambiar la promesa del producto", () => {
    const kiosco = rubroExamples.find((rubro) => rubro.id === "kiosco");
    const tienda = rubroExamples.find((rubro) => rubro.id === "tienda");

    expect(kiosco?.catalogLabel).toBe("Productos");
    expect(tienda?.catalogLabel).toBe("Catálogo");
    expect(kiosco?.metricLabel).toBe("Productos");
    expect(tienda?.metricLabel).toBe("Pedidos");
    expect(kiosco?.metricValue).not.toBe(tienda?.metricValue);
    expect(kiosco?.description).toContain("stock");
    expect(tienda?.description).toContain("Catálogo");
  });
});


describe("testimonios", () => {
  it("representa más de un tipo de negocio", () => {
    const roles = landingTestimonials.map((testimonial) => testimonial.role);

    expect(roles).toContain("Dueña de kiosco");
    expect(roles).toContain("Dueña de tienda");
    expect(roles).toContain("Profesional independiente");
  });
});
