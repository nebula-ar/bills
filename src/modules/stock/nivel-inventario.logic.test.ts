import { describe, expect, it } from "vitest";

import { marcaEnEscala, nivelDeInventario } from "./nivel-inventario.logic";

const ONE = 1000;

describe("nivelDeInventario", () => {
  it("sin existencia conocida no ubica nada", () => {
    // null no es cero: el producto no lleva control de stock.
    const nivel = nivelDeInventario({ actual: null, minimo: 10 * ONE, ideal: 30 * ONE });

    expect(nivel.estado).toBe("sin-datos");
    expect(nivel.posicion).toBeNull();
  });

  it("distingue 'se acabó' de 'está por acabarse'", () => {
    const vacio = nivelDeInventario({ actual: 0, minimo: 10 * ONE, ideal: 30 * ONE });
    const bajo = nivelDeInventario({ actual: 8 * ONE, minimo: 10 * ONE, ideal: 30 * ONE });

    // Piden acciones distintas: reponer ya vs anotarlo para la próxima compra.
    expect(vacio.estado).toBe("sin-stock");
    expect(bajo.estado).toBe("bajo");
  });

  it("justo en el mínimo ya cuenta como bajo", () => {
    // El mínimo es el punto de reposición: llegar a él ES el aviso, no el
    // renglón anterior al aviso.
    expect(nivelDeInventario({ actual: 10 * ONE, minimo: 10 * ONE, ideal: 30 * ONE }).estado).toBe("bajo");
  });

  it("marca excedido cuando hay más que el ideal", () => {
    expect(nivelDeInventario({ actual: 45 * ONE, minimo: 10 * ONE, ideal: 30 * ONE }).estado).toBe("excedido");
  });

  it("estira la escala cuando la existencia pasa el ideal", () => {
    // Si el tope fuera el ideal, 45 y 90 quedarían los dos clavados en el
    // extremo y el medidor no distinguiría "un poco de más" de "el triple".
    const poco = nivelDeInventario({ actual: 45 * ONE, minimo: 10 * ONE, ideal: 30 * ONE });
    const mucho = nivelDeInventario({ actual: 90 * ONE, minimo: 10 * ONE, ideal: 30 * ONE });

    expect(poco.posicion).not.toBeNull();
    expect(mucho.posicion).not.toBeNull();
    expect(poco.tope).toBeLessThan(mucho.tope as number);
  });

  it("sin ideal arma la escala con el mínimo", () => {
    // La mayoría de los rubros no carga ideal. Igual se puede ubicar la
    // existencia contra su punto de reposición.
    const nivel = nivelDeInventario({ actual: 15 * ONE, minimo: 10 * ONE, ideal: null });

    expect(nivel.posicion).not.toBeNull();
    expect(nivel.faltaParaIdeal).toBeNull();
  });

  it("sin mínimo ni ideal no hay escala que dibujar", () => {
    const nivel = nivelDeInventario({ actual: 15 * ONE, minimo: null, ideal: null });

    expect(nivel.estado).toBe("ok");
    expect(nivel.posicion).toBeNull();
    expect(nivel.tope).toBeNull();
  });

  it("dice cuánto falta para llegar al ideal, y nunca en negativo", () => {
    expect(nivelDeInventario({ actual: 24 * ONE, minimo: 10 * ONE, ideal: 30 * ONE }).faltaParaIdeal).toBe(6 * ONE);
    // Con stock de sobra no "falta -15": no falta nada.
    expect(nivelDeInventario({ actual: 45 * ONE, minimo: 10 * ONE, ideal: 30 * ONE }).faltaParaIdeal).toBe(0);
  });
});

describe("marcaEnEscala", () => {
  it("ubica la marca como fracción del tope", () => {
    expect(marcaEnEscala(25, 100)).toBe(0.25);
  });

  it("no se sale del medidor", () => {
    expect(marcaEnEscala(150, 100)).toBe(1);
  });

  it("sin valor o sin escala no hay marca", () => {
    expect(marcaEnEscala(null, 100)).toBeNull();
    expect(marcaEnEscala(25, null)).toBeNull();
    expect(marcaEnEscala(25, 0)).toBeNull();
  });
});
