import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  LIMITE_CARTA_PUBLICA,
} from "./rate-limit";

/**
 * Los endpoints públicos del QR no tienen sesión: se autentican sólo con el
 * token de la mesa. Una server action es un POST, así que cualquiera que
 * fotografió el código podía llamarlas en bucle — crear comandas en todas las
 * mesas de madrugada, quemar el correlativo de la organización y llenar la base
 * de OrderItem. No había ningún freno en todo el repo.
 */

beforeEach(() => resetRateLimit());

describe("checkRateLimit", () => {
  it("deja pasar hasta el máximo", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("mesa-1", 3, 60_000, 1000).permitido).toBe(true);
    }
  });

  it("bloquea el intento que se pasa", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("mesa-1", 3, 60_000, 1000);
    const r = checkRateLimit("mesa-1", 3, 60_000, 1000);
    expect(r.permitido).toBe(false);
    expect(r.permitido === false && r.esperarMs).toBeGreaterThan(0);
  });

  it("informa cuántos intentos quedan", () => {
    const a = checkRateLimit("mesa-1", 3, 60_000, 1000);
    expect(a.permitido === true && a.restantes).toBe(2);
    const b = checkRateLimit("mesa-1", 3, 60_000, 1000);
    expect(b.permitido === true && b.restantes).toBe(1);
  });

  it("cada mesa tiene su propio cupo", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("mesa-1", 3, 60_000, 1000);
    expect(checkRateLimit("mesa-1", 3, 60_000, 1000).permitido).toBe(false);
    // Una mesa saturada no afecta a la de al lado.
    expect(checkRateLimit("mesa-2", 3, 60_000, 1000).permitido).toBe(true);
  });

  it("la ventana se renueva al pasar el tiempo", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("mesa-1", 3, 60_000, 1000);
    expect(checkRateLimit("mesa-1", 3, 60_000, 1000).permitido).toBe(false);
    // Un minuto y pico después, cupo nuevo.
    expect(checkRateLimit("mesa-1", 3, 60_000, 62_000).permitido).toBe(true);
  });

  it("el límite de la carta pública tolera una mesa real", () => {
    const { maximo, ventanaMs } = LIMITE_CARTA_PUBLICA;
    // Una mesa de 4 personas pidiendo tranquila: bastante menos de 40 toques.
    for (let i = 0; i < 25; i++) {
      expect(checkRateLimit("mesa-real", maximo, ventanaMs, 1000).permitido).toBe(
        true,
      );
    }
  });

  it("pero corta un bucle automatizado", () => {
    const { maximo, ventanaMs } = LIMITE_CARTA_PUBLICA;
    let bloqueadoEn = -1;
    for (let i = 0; i < 200; i++) {
      if (!checkRateLimit("bot", maximo, ventanaMs, 1000).permitido) {
        bloqueadoEn = i;
        break;
      }
    }
    expect(bloqueadoEn).toBe(maximo);
  });
});
