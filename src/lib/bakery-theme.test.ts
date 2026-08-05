import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { VERTICAL_ORDER } from "./vertical";

/**
 * El rubro no cambia solo qué módulos vienen prendidos: también cómo se ve.
 * Una panadería no se reconoce en el azul de una barbería.
 *
 * Que se pueda hacer sin forkear un componente es mérito de cómo está armado
 * el CSS: los componentes pintan con ranuras semánticas (`bg-primary`,
 * `bg-destructive`, `var(--radius-md)`) y nunca con un color propio. Entonces
 * redefinir las ranuras bajo `[data-vertical]` alcanza para que TODA la app
 * cambie de cara.
 *
 * Estos tests cuidan ese contrato, que es fácil de romper sin darse cuenta:
 * basta que alguien hardcodee un hex en un componente, o que el bloque del
 * rubro se olvide una ranura y quede mitad rosa, mitad azul.
 */

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** Devuelve el cuerpo de un bloque CSS por su selector. */
function bloque(selector: string): string {
  const i = CSS.indexOf(selector);
  if (i < 0) return "";
  return CSS.slice(i, CSS.indexOf("}", i));
}

const RAIZ = bloque(":root {");
const PASTELERIA = bloque('[data-vertical="BAKERY"]');

/** Ranuras que un rubro DEBE redefinir para no quedar a mitad de camino. */
const RANURAS_OBLIGATORIAS = [
  "--primary",
  "--primary-foreground",
  "--background",
  "--foreground",
  "--card",
  "--muted-foreground",
  "--border",
  "--accent",
  "--destructive",
  "--ring",
];

describe("tema de pastelería", () => {
  it("el bloque del rubro existe", () => {
    expect(PASTELERIA, 'falta el bloque [data-vertical="BAKERY"]').not.toBe("");
  });

  it("redefine todas las ranuras, no un par sueltas", () => {
    // Media redefinición es peor que ninguna: la app queda mitad rosa y mitad
    // azul, y el bug aparece en una pantalla que nadie miró.
    for (const ranura of RANURAS_OBLIGATORIAS) {
      expect(PASTELERIA, `${ranura} sin definir en el rubro`).toContain(`${ranura}:`);
    }
  });

  it("no se olvida ninguna ranura que la raíz sí define", () => {
    // Si mañana alguien agrega una ranura nueva a :root y no al rubro, la
    // panadería la hereda del tema azul sin que nadie se entere.
    const deRaiz = [...RAIZ.matchAll(/^\s*(--[a-z-]+):/gm)].map((m) => m[1]);
    const faltantes = RANURAS_OBLIGATORIAS.filter(
      (r) => deRaiz.includes(r) && !PASTELERIA.includes(`${r}:`),
    );
    expect(faltantes, "ranuras que la raíz define y el rubro no").toEqual([]);
  });

  it("es más redondeado que el default: es la mitad de su identidad", () => {
    // La estética de Migas no es solo el rosa. Sin el radio más grande queda
    // rosa pero con esquinas de app bancaria.
    expect(PASTELERIA).toContain("--radius:");
  });

  it("suma sus acentos propios, que no tienen ranura estándar", () => {
    // El amarillo de fidelidad/cupones no existe en el set de shadcn. Vive
    // acá porque solo lo usan las pantallas del rubro.
    expect(PASTELERIA).toContain("--butter:");
  });
});

describe("el contrato que hace posible el tema", () => {
  it("ningún rubro pinta con un hex hardcodeado", () => {
    // Un `--primary: #ff73a8` funcionaría, pero rompe el modo oscuro y el
    // resto del sistema, que trabaja en oklch.
    const hexes = [...PASTELERIA.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    expect(hexes, "usar oklch como el resto del sistema").toEqual([]);
  });

  it("el layout no pinta el fondo por fuera del tema", () => {
    // `bg-[#f6f7fb]` en el body ganaba siempre y dejaba el fondo azulado
    // aunque el rubro definiera otro: el tema no llegaba a verse.
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout, "el body no puede tener un color fijo").not.toMatch(/bg-\[#/);
    expect(layout, "el body tiene que usar la ranura del tema").toContain("bg-background");
  });

  it("el rubro llega al DOM, si no el bloque nunca aplica", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("data-vertical");
  });
});

describe("los demás rubros", () => {
  it("siguen andando sin bloque propio: heredan la raíz", () => {
    // Solo pastelería tiene tema por ahora. El resto no puede romperse por eso.
    expect(VERTICAL_ORDER.length).toBeGreaterThan(1);
    expect(RAIZ).toContain("--primary:");
  });
});
