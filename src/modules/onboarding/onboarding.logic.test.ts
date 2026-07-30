import { Vertical } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { onboardingSteps } from "./onboarding.logic";

describe("onboardingSteps", () => {
  it("no vuelve a preguntar por la sucursal", () => {
    // El bug que motivó esto: se pedía el nombre del negocio y después el del
    // local, que para un solo local es la misma pregunta.
    const ids = onboardingSteps(Vertical.KIOSK).map((step) => step.id);

    expect(ids).toEqual(["vertical", "businessName", "ownerName", "email", "password", "staff"]);
    expect(ids.filter((id) => id === "businessName")).toHaveLength(1);
  });

  it("no pide el catálogo: eso se carga adentro de la app", () => {
    // Decidir precios antes de haber visto el sistema no tiene sentido, y con
    // el paso adentro el rubro "Otro comercio" (sin catálogo sugerido) dejaba
    // el alta trabada.
    for (const vertical of Object.values(Vertical)) {
      expect(onboardingSteps(vertical).map((step) => step.id)).not.toContain("catalog");
    }
  });

  it("el rubro se elige primero, porque renombra todo lo que sigue", () => {
    expect(onboardingSteps(Vertical.GROCERY)[0].id).toBe("vertical");
  });

  it("nombra a quien atiende como lo nombra el rubro", () => {
    const barberia = onboardingSteps(Vertical.BARBERSHOP).find((step) => step.id === "staff");
    const kiosco = onboardingSteps(Vertical.KIOSK).find((step) => step.id === "staff");

    expect(barberia?.subtitle).toContain("barbero");
    expect(kiosco?.subtitle).toContain("vendedor");
  });

  it("usa los iconos del rubro y no los de barbería", () => {
    const kiosco = onboardingSteps(Vertical.KIOSK);
    const barberia = onboardingSteps(Vertical.BARBERSHOP);

    expect(kiosco.find((step) => step.id === "businessName")?.icon).toBe("solar:cup-hot-bold");
    expect(barberia.find((step) => step.id === "businessName")?.icon).toBe("solar:scissors-bold");
    // Ningún paso del kiosco muestra tijeras.
    expect(kiosco.map((step) => step.icon)).not.toContain("solar:scissors-bold");
  });

  it("propone un nombre de ejemplo del rubro", () => {
    const paso = (vertical: Vertical) => onboardingSteps(vertical).find((step) => step.id === "businessName");

    expect(paso(Vertical.HARDWARE)?.placeholder).toBe("Ej: Ferretería El Tornillo");
    expect(paso(Vertical.KIOSK)?.placeholder).toBe("Ej: Kiosco El Rulo");
  });

});
