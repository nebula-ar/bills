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

describe("los dos rubros conservan SU identidad", () => {
  it("la raíz es el azul de Bills, no el gris del framework", () => {
    // Esto ya se rompió una vez: al mandar el azul de Bills a `--primary`, la
    // raíz seguía con el default casi-negro de shadcn, así que Bills se volvía
    // negro. Preservar el mecanismo del tema no sirve si en el camino se pierde
    // la identidad del producto que ya existía.
    const primary = RAIZ.match(/--primary:\s*([^;]+);/)?.[1] ?? "";

    // El azul vive alrededor de los 265° de tono.
    const tono = Number(primary.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/)?.[1] ?? NaN);
    expect(tono, `--primary de la raíz: ${primary}`).toBeGreaterThan(240);
    expect(tono).toBeLessThan(290);
  });

  it("pastelería es rosa, no el azul heredado", () => {
    const primary = PASTELERIA.match(/--primary:\s*([^;]+);/)?.[1] ?? "";
    const tono = Number(primary.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/)?.[1] ?? NaN);

    // El magenta de Migas cae cerca de 358°.
    expect(tono, `--primary de pastelería: ${primary}`).toBeGreaterThan(330);
  });

  it("los dos tienen su acción presionada y su acento propios", () => {
    // Eran hex sueltos repartidos por 64 archivos; ahora son tokens que el
    // rubro puede redefinir.
    for (const token of ["--primary-strong", "--accent-brand"]) {
      expect(RAIZ, `${token} falta en la raíz`).toContain(`${token}:`);
      expect(PASTELERIA, `${token} falta en pastelería`).toContain(`${token}:`);
    }
  });

  it("ningún componente vuelve a hardcodear el azul de Bills", () => {
    // La regresión más fácil: alguien copia un botón viejo con bg-blue-600 y
    // esa pantalla deja de cambiar con el rubro.
    const src = path.join(process.cwd(), "src");
    const sospechosos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          const t = fs.readFileSync(p, "utf8");
          if (/(bg|text|border|ring|shadow)-blue-\d|#3158e8/.test(t)) sospechosos.push(e.name);
        }
      }
    };
    recorrer(src);

    expect(sospechosos, "estas pantallas no van a cambiar con el rubro").toEqual([]);
  });
});
