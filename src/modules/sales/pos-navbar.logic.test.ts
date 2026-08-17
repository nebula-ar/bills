import { describe, expect, it } from "vitest";

import { SaleChannel } from "@/generated/prisma/enums";

import {
  agruparPorSector,
  canalDeDestino,
  estadoDeMesa,
  filtrarMesas,
  mesasAbiertas,
  estadoDeNavbar,
  etiquetaDeDestino,
  filtrarPorNombre,
  necesitaBuscador,
  vendedorParaDestino,
  type Destino,
} from "./pos-navbar.logic";

const caja: Destino = { tipo: "caja" };
const mesa: Destino = { tipo: "mesa", tableId: "t12", nombre: "Mesa 12" };

describe("canalDeDestino", () => {
  it("solo la mesa graba TABLE", () => {
    // Es la única distinción que alguien mira después: `sale-channel.logic.ts`
    // pregunta `!== TABLE` y el ticket pregunta `=== TABLE`. Por eso el destino
    // tiene dos opciones y no tres: "para llevar" terminaba en COUNTER igual
    // que el mostrador y no lo leía nadie.
    expect(canalDeDestino(mesa)).toBe(SaleChannel.TABLE);
    expect(canalDeDestino(caja)).toBe(SaleChannel.COUNTER);
  });
});

describe("etiquetaDeDestino", () => {
  it("la mesa se llama por su nombre, no 'Mesa'", () => {
    expect(etiquetaDeDestino(mesa)).toBe("Mesa 12");
  });

  it("el default se llama Caja", () => {
    expect(etiquetaDeDestino(caja)).toBe("Caja");
  });
});

describe("estadoDeNavbar", () => {
  it("en Caja no hay estado: no se inventa nada para llenar el hueco", () => {
    // "Abierta" y los minutos son de una mesa. Sin mesa, ese lugar del navbar
    // queda vacío a propósito.
    expect(estadoDeNavbar({ destino: caja, pendientes: 0, minutosAbierta: 42 })).toBeNull();
    expect(estadoDeNavbar({ destino: caja, pendientes: 3, minutosAbierta: null })).toBeNull();
  });

  it("lo pendiente GANA sobre 'Abierta'", () => {
    // El caso que justifica todo el módulo. Una mesa abierta es lo normal y no
    // pide nada; dos platos sin mandar a cocina sí, y no se arreglan solos.
    expect(estadoDeNavbar({ destino: mesa, pendientes: 2, minutosAbierta: 42 })).toEqual({
      tono: "aviso",
      texto: "2 sin mandar",
    });
  });

  it("uno solo se dice en singular", () => {
    expect(estadoDeNavbar({ destino: mesa, pendientes: 1, minutosAbierta: 10 })?.texto).toBe("1 sin mandar");
  });

  it("sin pendientes muestra desde cuándo está abierta", () => {
    expect(estadoDeNavbar({ destino: mesa, pendientes: 0, minutosAbierta: 42 })).toEqual({
      tono: "normal",
      texto: "Abierta · 42 min",
    });
  });

  it("sin minutos no dice '0 min'", () => {
    // Una mesa recién abierta con "Abierta · 0 min" se lee como un error de
    // cálculo, no como información.
    expect(estadoDeNavbar({ destino: mesa, pendientes: 0, minutosAbierta: null })).toEqual({
      tono: "normal",
      texto: "Abierta",
    });
  });
});

describe("vendedorParaDestino", () => {
  const disponibles = [{ id: "matias" }, { id: "cocinero" }];

  it("el mozo de la mesa le gana al elegido a mano", () => {
    // Es la regla de plata: la comisión va a quien atendió la mesa, no a quien
    // apretó el botón de cobrar.
    expect(
      vendedorParaDestino({ actual: "cocinero", mozoDeLaMesa: "matias", disponibles }),
    ).toEqual({ staffId: "matias", porQue: "mesa" });
  });

  it("sin mozo guardado, manda lo que se eligió", () => {
    expect(vendedorParaDestino({ actual: "cocinero", mozoDeLaMesa: null, disponibles })).toEqual({
      staffId: "cocinero",
      porQue: "elegido",
    });
  });

  it("un mozo que no trabaja en esta sucursal NO se usa", () => {
    // Pasa al cambiar de sucursal con una mesa elegida: ese empleado no existe
    // acá, y `createSale` rechaza la venta con STAFF_WRONG_BRANCH. Mejor caer
    // en el elegido que mandar una venta que el servidor va a rebotar.
    expect(
      vendedorParaDestino({ actual: "cocinero", mozoDeLaMesa: "de-otra-sucursal", disponibles }),
    ).toEqual({ staffId: "cocinero", porQue: "elegido" });
  });

  it("un elegido que ya no está tampoco se usa", () => {
    expect(vendedorParaDestino({ actual: "renunciado", mozoDeLaMesa: null, disponibles })).toEqual({
      staffId: null,
      porQue: "ninguno",
    });
  });

  it("sin nada devuelve ninguno, no el primero de la lista", () => {
    // Preseleccionar al primero le atribuye ventas ajenas a alguien en
    // silencio. Es plata mal repartida y nadie se entera hasta fin de mes.
    expect(vendedorParaDestino({ actual: null, mozoDeLaMesa: null, disponibles })).toEqual({
      staffId: null,
      porQue: "ninguno",
    });
  });
});

describe("necesitaBuscador", () => {
  it("ocho entran sin buscador; nueve ya es un muro", () => {
    expect(necesitaBuscador(8)).toBe(false);
    expect(necesitaBuscador(9)).toBe(true);
  });

  it("con dos empleados obviamente no", () => {
    expect(necesitaBuscador(2)).toBe(false);
  });
});

describe("filtrarPorNombre", () => {
  const gente = [{ name: "Matías" }, { name: "Cocinero" }, { name: "Ramón Pérez" }];

  it("encuentra sin acentos: nadie tipea la tilde apurado", () => {
    expect(filtrarPorNombre(gente, "matias")).toEqual([{ name: "Matías" }]);
    expect(filtrarPorNombre(gente, "ramon")).toEqual([{ name: "Ramón Pérez" }]);
  });

  it("no distingue mayúsculas", () => {
    expect(filtrarPorNombre(gente, "COCI")).toEqual([{ name: "Cocinero" }]);
  });

  it("busca en cualquier parte del nombre, no solo al principio", () => {
    // El apellido es lo que muchos tipean.
    expect(filtrarPorNombre(gente, "perez")).toEqual([{ name: "Ramón Pérez" }]);
  });

  it("vacío devuelve todo", () => {
    expect(filtrarPorNombre(gente, "   ")).toHaveLength(3);
  });

  it("sin resultados devuelve lista vacía, no todo", () => {
    expect(filtrarPorNombre(gente, "zzz")).toEqual([]);
  });
});

describe("agruparPorSector", () => {
  it("respeta el orden en que vienen, no el alfabético", () => {
    // Los sectores llegan por `sector.sortOrder`, que es como el dueño acomodó
    // su local. Ordenarlos alfabéticamente sería reordenárselo.
    const grupos = agruparPorSector([
      { sector: "Terraza" },
      { sector: "Salón" },
      { sector: "Terraza" },
    ]);
    expect(grupos.map(([nombre]) => nombre)).toEqual(["Terraza", "Salón"]);
    expect(grupos[0][1]).toHaveLength(2);
  });

  it("las mesas sin sector caen en un balde propio", () => {
    // Existen: quedan así si alguien borra el sector que las contenía. Sin este
    // balde desaparecerían del selector y no habría forma de cobrarlas.
    const grupos = agruparPorSector([{ sector: null }, { sector: "Salón" }]);
    expect(grupos.map(([nombre]) => nombre)).toEqual(["Sin sector", "Salón"]);
  });

  it("sin mesas devuelve una lista vacía", () => {
    expect(agruparPorSector([])).toEqual([]);
  });
});

describe("estadoDeMesa", () => {
  const plata = (valor: number) => `$ ${valor}`;
  const conComanda = (comanda: { total: number; items: number; pendientes: number; minutosAbierta: number }) => ({
    id: "t", name: "Mesa 1", sector: "Salón", comanda,
  });

  it("sin comanda está libre", () => {
    expect(estadoDeMesa({ id: "t", name: "Mesa 1", sector: null, comanda: null }, plata)).toEqual({ tipo: "libre" });
  });

  it("lo pendiente gana sobre la plata", () => {
    expect(
      estadoDeMesa(conComanda({ total: 5000, items: 4, pendientes: 2, minutosAbierta: 12 }), plata),
    ).toEqual({ tipo: "pendiente", detalle: "2 sin mandar" });
  });

  it("REGRESIÓN: tres platos sin mandar con total en CERO no es una mesa vacía", () => {
    // El total de la comanda cuenta SOLO lo confirmado, porque cobrar un
    // borrador sería cobrar algo que la cocina nunca vio. Así que una mesa
    // recién cargada muestra $0 legítimamente. Si el estado dijera la plata,
    // esa mesa se vería idéntica a una libre y el mozo perdería el pedido.
    expect(estadoDeMesa(conComanda({ total: 0, items: 3, pendientes: 3, minutosAbierta: 2 }), plata)).toEqual({
      tipo: "pendiente",
      detalle: "3 sin mandar",
    });
  });

  it("todo mandado muestra plata, ítems y minutos", () => {
    expect(
      estadoDeMesa(conComanda({ total: 28310, items: 4, pendientes: 0, minutosAbierta: 42 }), plata),
    ).toEqual({ tipo: "ocupada", detalle: "$ 28310 · 4 ítems · 42 min" });
  });

  it("un ítem se dice en singular", () => {
    expect(estadoDeMesa(conComanda({ total: 900, items: 1, pendientes: 0, minutosAbierta: 3 }), plata)).toEqual({
      tipo: "ocupada",
      detalle: "$ 900 · 1 ítem · 3 min",
    });
  });
});

describe("filtrarMesas", () => {
  const mesas = [
    { name: "Mesa 1", sector: "Vereda" },
    { name: "Mesa 10", sector: "Terraza" },
    { name: "Mesa 11", sector: "Terraza" },
  ];

  it("busca por SECTOR, no solo por nombre", () => {
    // Escribir el lugar donde uno está parado tiene que traer ese lugar entero.
    expect(filtrarMesas(mesas, "terraza")).toHaveLength(2);
  });

  it("el sector también funciona sin acentos", () => {
    expect(filtrarMesas([{ name: "Mesa 1", sector: "Salón" }], "salon")).toHaveLength(1);
  });

  it("sigue funcionando por nombre", () => {
    expect(filtrarMesas(mesas, "Mesa 11")).toEqual([{ name: "Mesa 11", sector: "Terraza" }]);
  });

  it("una mesa sin sector no rompe la búsqueda", () => {
    expect(filtrarMesas([{ name: "Mesa 9", sector: null }], "vereda")).toEqual([]);
    expect(filtrarMesas([{ name: "Mesa 9", sector: null }], "9")).toHaveLength(1);
  });
});

describe("mesasAbiertas", () => {
  const mesa = (id: string, comanda: { pendientes: number; minutosAbierta: number } | null) => ({ id, comanda });

  it("deja afuera las libres", () => {
    expect(mesasAbiertas([mesa("a", null), mesa("b", { pendientes: 0, minutosAbierta: 5 })])).toHaveLength(1);
  });

  it("lo que tiene algo sin mandar va PRIMERO, aunque lleve menos tiempo", () => {
    // Un plato sin mandar a cocina se pierde si nadie lo mira. Una mesa que
    // espera la cuenta, no: el cliente está ahí y va a volver a pedirla.
    const orden = mesasAbiertas([
      mesa("vieja", { pendientes: 0, minutosAbierta: 90 }),
      mesa("pendiente", { pendientes: 2, minutosAbierta: 3 }),
    ]);
    expect(orden.map((m) => m.id)).toEqual(["pendiente", "vieja"]);
  });

  it("entre las que están al día, la que más espera va arriba", () => {
    // Por TIEMPO y no por plata: la mesa más cara no es la más urgente, la que
    // hace una hora y media que pidió la cuenta sí.
    const orden = mesasAbiertas([
      mesa("nueva", { pendientes: 0, minutosAbierta: 5 }),
      mesa("vieja", { pendientes: 0, minutosAbierta: 90 }),
    ]);
    expect(orden.map((m) => m.id)).toEqual(["vieja", "nueva"]);
  });

  it("sin mesas abiertas devuelve vacío, para que el bloque no se dibuje", () => {
    expect(mesasAbiertas([mesa("a", null)])).toEqual([]);
  });
});
