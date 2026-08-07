import { KdsStatus } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import {
  COLUMNAS_COCINA,
  enTablero,
  nivelDeDemora,
  puedeAvanzar,
  repartirEnColumnas,
  siguienteEstado,
  textoDeEspera,
} from "./kitchen";

/**
 * Pantalla de cocina (KDS): qué preparar y en qué orden.
 *
 * No es una pantalla de gestión: la mira el cocinero mientras trabaja, con las
 * manos ocupadas, de reojo y a un metro de distancia. Por eso la lógica que
 * decide qué se ve y con qué urgencia vive acá, probada, y no repartida en el
 * componente.
 */

const AHORA = 1_700_000_000_000; // instante fijo: los tests no dependen del reloj
const haceMinutos = (m: number) => AHORA - m * 60_000;

describe("el carrito del QR NO es cocina", () => {
  it("un ítem en carrito no aparece en el tablero", () => {
    // Lo cargó el cliente desde el QR y el mozo todavía no lo confirmó. Si
    // llegara a cocina, se prepararía comida que nadie pidió en firme: alcanza
    // con que alguien juegue con el menú mientras espera.
    expect(enTablero(KdsStatus.CART)).toBe(false);
  });

  it("tampoco entra si se lo reparte en columnas", () => {
    const columnas = repartirEnColumnas([
      { kdsStatus: KdsStatus.CART },
      { kdsStatus: KdsStatus.PENDING },
    ]);

    expect(columnas[KdsStatus.PENDING]).toHaveLength(1);
    expect(Object.values(columnas).flat()).toHaveLength(1);
  });

  it("confirmarlo es del mozo, no del cocinero", () => {
    // El mozo es quien ve la mesa y decide que el pedido va. Dejar que la
    // cocina lo confirme sola saltea ese control.
    expect(puedeAvanzar(KdsStatus.CART, ["kitchen"])).toBe(false);
    expect(puedeAvanzar(KdsStatus.CART, ["waitTables"])).toBe(true);
  });
});

describe("cómo avanza un pedido", () => {
  it("recorre los estados en orden", () => {
    expect(siguienteEstado(KdsStatus.CART)).toBe(KdsStatus.PENDING);
    expect(siguienteEstado(KdsStatus.PENDING)).toBe(KdsStatus.PREPARING);
    expect(siguienteEstado(KdsStatus.PREPARING)).toBe(KdsStatus.READY);
    expect(siguienteEstado(KdsStatus.READY)).toBe(KdsStatus.DELIVERED);
  });

  it("entregado es el final: no se pasa de ahí", () => {
    expect(siguienteEstado(KdsStatus.DELIVERED)).toBe(KdsStatus.DELIVERED);
  });

  it("entregado sale del tablero", () => {
    // Si se quedara, la cocina terminaría el turno mirando una pantalla llena
    // de cosas ya entregadas y perdería de vista lo que falta.
    expect(enTablero(KdsStatus.DELIVERED)).toBe(false);
    expect(enTablero(KdsStatus.PENDING)).toBe(true);
    expect(enTablero(KdsStatus.PREPARING)).toBe(true);
    expect(enTablero(KdsStatus.READY)).toBe(true);
  });

  it("el cocinero avanza lo suyo, y solo lo suyo", () => {
    for (const estado of [KdsStatus.PENDING, KdsStatus.PREPARING, KdsStatus.READY]) {
      expect(puedeAvanzar(estado, ["kitchen"]), estado).toBe(true);
    }
    // Ya entregado no hay nada que avanzar.
    expect(puedeAvanzar(KdsStatus.DELIVERED, ["kitchen"])).toBe(false);
  });

  it("sin permiso de cocina no se toca nada", () => {
    expect(puedeAvanzar(KdsStatus.PENDING, ["sell"])).toBe(false);
    expect(puedeAvanzar(KdsStatus.PENDING, [])).toBe(false);
  });

  it("las columnas del tablero son las tres activas", () => {
    expect([...COLUMNAS_COCINA]).toEqual([
      KdsStatus.PENDING,
      KdsStatus.PREPARING,
      KdsStatus.READY,
    ]);
  });
});

describe("cuánto hace que espera", () => {
  it("bajo la hora muestra minutos y segundos corriendo", () => {
    // Los segundos importan: en vivo, un número quieto parece pantalla colgada.
    expect(textoDeEspera(AHORA - 90_000, AHORA)).toBe("1:30");
    expect(textoDeEspera(AHORA - 5_000, AHORA)).toBe("0:05");
  });

  it("pasada la hora deja de contar segundos", () => {
    // "132 minutos" no le dice nada a nadie a un metro de distancia.
    expect(textoDeEspera(haceMinutos(72), AHORA)).toBe("1h 12m");
  });

  it("un reloj desfasado no muestra tiempos negativos", () => {
    // El del salón y el del servidor no siempre coinciden.
    expect(textoDeEspera(AHORA + 60_000, AHORA)).toBe("0:00");
  });
});

describe("el semáforo de demora", () => {
  it("dentro del tiempo estimado está normal", () => {
    expect(nivelDeDemora(5, 10)).toBe("normal");
  });

  it("al alcanzar el estimado avisa", () => {
    expect(nivelDeDemora(10, 10)).toBe("atencion");
  });

  it("pasado el 50% se vuelve urgente", () => {
    expect(nivelDeDemora(15, 10)).toBe("urgente");
  });

  it("sin tiempo estimado usa un umbral razonable", () => {
    // La mayoría de los productos no tiene estimado cargado: en Migas solo 6
    // de 56. Sin un default, el semáforo no serviría para casi nada.
    expect(nivelDeDemora(5, null)).toBe("normal");
    expect(nivelDeDemora(10, null)).toBe("atencion");
    expect(nivelDeDemora(20, null)).toBe("urgente");
  });

  it("un estimado en cero o negativo no rompe el semáforo", () => {
    // Un cero cargado a mano dividiría todo por nada y dejaría todo en rojo.
    expect(nivelDeDemora(1, 0)).toBe("normal");
    expect(nivelDeDemora(1, -5)).toBe("normal");
  });
});
