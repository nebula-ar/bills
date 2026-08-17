import { SaleChannel } from "@/generated/prisma/enums";

/**
 * Qué dice el navbar del mostrador: a dónde va la venta, cómo está esa mesa y
 * quién la atiende.
 *
 * Es lógica pura porque son tres reglas con filo y ninguna se puede probar
 * mirando la pantalla: cuál de dos avisos gana, qué se esconde cuando no hay
 * mesa, y cuándo un vendedor elegido a mano tiene que ceder ante un dato
 * guardado. Las tres reparten plata o trabajo, así que van con tests.
 */

/**
 * A dónde va la venta. Dos opciones y no tres.
 *
 * Existía también "Para llevar", y se sacó: el que se lo lleva paga en la caja
 * igual que el que se lo come parado, así que era un toque de más en cada venta
 * de mostrador para elegir entre dos cosas que terminan en el mismo lugar.
 * Tampoco lo miraba nadie —`TAKEAWAY` no aparecía en un solo reporte, ticket ni
 * tablero—, así que ni siquiera servía para saber después cuánto se vendió para
 * llevar. El único corte real es mesa o no mesa.
 */
export type Destino = { tipo: "caja" } | { tipo: "mesa"; tableId: string; nombre: string };

/** El canal que se graba en la venta. Solo TABLE vs no-TABLE cambia algo aguas abajo. */
export function canalDeDestino(destino: Destino): SaleChannel {
  return destino.tipo === "mesa" ? SaleChannel.TABLE : SaleChannel.COUNTER;
}

/** Lo que se lee en la pastilla del navbar. */
export function etiquetaDeDestino(destino: Destino): string {
  return destino.tipo === "mesa" ? destino.nombre : "Caja";
}

export type EstadoDeNavbar =
  | { tono: "aviso"; texto: string }
  | { tono: "normal"; texto: string }
  | null;

/**
 * La línea de estado al lado de la pastilla.
 *
 * El orden no es cosmético: lo pendiente GANA sobre "Abierta". Una mesa abierta
 * es la situación normal y no pide nada; dos platos que quedaron sin ir a
 * cocina sí, y no se recuperan solos. Si "Abierta" tapara ese aviso, el navbar
 * estaría usando su lugar más visible para decir lo que menos importa.
 *
 * En Caja devuelve null: no hay mesa, así que "Abierta" y los minutos no
 * existen. Rellenar eso con algo inventado es peor que dejarlo vacío.
 */
export function estadoDeNavbar(input: {
  destino: Destino;
  /** Ítems cargados que todavía no se mandaron a cocina. */
  pendientes: number;
  /** Hace cuánto se abrió la comanda. null = recién abierta o sin dato. */
  minutosAbierta: number | null;
}): EstadoDeNavbar {
  if (input.destino.tipo !== "mesa") return null;

  if (input.pendientes > 0) {
    return {
      tono: "aviso",
      texto: input.pendientes === 1 ? "1 sin mandar" : `${input.pendientes} sin mandar`,
    };
  }

  if (input.minutosAbierta === null) return { tono: "normal", texto: "Abierta" };
  return { tono: "normal", texto: `Abierta · ${input.minutosAbierta} min` };
}

/**
 * Quién queda como vendedor al pararse en un destino.
 *
 * El mozo que abrió la mesa es un DATO guardado; lo que el usuario dejó
 * seleccionado en el navbar es una preferencia. Cuando hay dato, gana el dato:
 * la comisión tiene que ir a quien atendió la mesa, no a quien apretó cobrar.
 *
 * Se devuelve también `porQue` para que la pantalla lo pueda mostrar: cambiar
 * el vendedor de alguien sin decir por qué es la clase de magia que hace
 * desconfiar del sistema justo donde no conviene.
 */
export function vendedorParaDestino(input: {
  /** El que está elegido ahora en el navbar. null = ninguno todavía. */
  actual: string | null;
  /** El mozo guardado en la comanda de la mesa. null = la mesa no tiene comanda. */
  mozoDeLaMesa: string | null;
  /** Los que pueden vender en esta sucursal. Un mozo de otra sucursal no cuenta. */
  disponibles: { id: string }[];
}): { staffId: string | null; porQue: "mesa" | "elegido" | "ninguno" } {
  const existe = (id: string | null) => id !== null && input.disponibles.some((staff) => staff.id === id);

  if (existe(input.mozoDeLaMesa)) {
    return { staffId: input.mozoDeLaMesa, porQue: "mesa" };
  }

  if (existe(input.actual)) {
    return { staffId: input.actual, porQue: "elegido" };
  }

  return { staffId: null, porQue: "ninguno" };
}

/**
 * Con cuántos empleados el listado deja de servir y hace falta buscador.
 *
 * En 2 columnas, ocho entran en cuatro renglones y se leen de un vistazo. Más
 * que eso es un muro: tipear tres letras es más rápido que barrer veinte
 * nombres con la vista.
 */
export const TOPE_SIN_BUSCADOR = 8;

export function necesitaBuscador(cantidad: number): boolean {
  return cantidad > TOPE_SIN_BUSCADOR;
}

/** Filtra por nombre sin acentos ni mayúsculas: "matias" encuentra "Matías". */
export function filtrarPorNombre<T extends { name: string }>(items: T[], busqueda: string): T[] {
  const query = normalizar(busqueda);
  if (query === "") return items;
  return items.filter((item) => normalizar(item.name).includes(query));
}

/**
 * Filtra mesas por nombre O por sector.
 *
 * Buscar "terraza" tiene que traer la terraza entera. Con el filtro solo por
 * nombre, escribir el lugar donde está parado el mozo no devolvía nada, que es
 * lo contrario de lo que un buscador promete.
 */
export function filtrarMesas<T extends { name: string; sector: string | null }>(
  mesas: T[],
  busqueda: string,
): T[] {
  const query = normalizar(busqueda);
  if (query === "") return mesas;
  return mesas.filter(
    (mesa) => normalizar(mesa.name).includes(query) || normalizar(mesa.sector ?? "").includes(query),
  );
}

/**
 * Las mesas con algo abierto, primero las que piden acción.
 *
 * Van arriba de todo y REPETIDAS —también aparecen en su sector— porque el
 * panel contesta dos preguntas distintas: "¿qué tengo que atender?" y "¿dónde
 * está sentado este cliente?". Ordenar por sector contesta la segunda y entierra
 * la primera; mostrarlas dos veces cuesta unos píxeles y resuelve las dos.
 *
 * Adentro, el orden es por urgencia y no por plata: primero lo que tiene algo
 * sin mandar a cocina —eso se pierde si nadie lo mira—, y después las que están
 * al día, de la que más tiempo lleva esperando a la que menos. La mesa más cara
 * no es la más urgente; la que hace 90 minutos que espera la cuenta, sí.
 *
 * NO se llama "Para cobrar": una mesa con platos sin mandar no está para
 * cobrar, está para atender. Prometer lo primero llevaría a cobrar comandas a
 * medio cargar.
 */
export function mesasAbiertas<T extends { comanda: { pendientes: number; minutosAbierta: number } | null }>(
  mesas: T[],
): T[] {
  return mesas
    .filter((mesa) => mesa.comanda !== null)
    .sort((a, b) => {
      const urgenteA = a.comanda!.pendientes > 0 ? 0 : 1;
      const urgenteB = b.comanda!.pendientes > 0 ? 0 : 1;
      if (urgenteA !== urgenteB) return urgenteA - urgenteB;
      return b.comanda!.minutosAbierta - a.comanda!.minutosAbierta;
    });
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    // Los diacríticos por código y no pegados como caracteres: escritos
    // literalmente son invisibles en el editor y el primer `git diff` que los
    // toque los rompe sin que nadie lo note.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type MesaParaAgrupar = {
  id: string;
  name: string;
  sector: string | null;
  comanda: { total: number; items: number; pendientes: number; minutosAbierta: number } | null;
};

/**
 * Las mesas agrupadas por sector, en el orden en que vienen.
 *
 * Por SECTOR y no por "ocupadas primero": el mozo no piensa "mostrame las
 * libres", piensa "voy a la terraza". Agrupar por estado obliga a barrer toda
 * la lista para saber qué hay en un sector, que es justo la pregunta que se
 * hace parado en la puerta.
 *
 * El estado no se pierde: pasa a cada fila (ver `estadoDeMesa`), que además es
 * donde se puede decir CUÁNTO tiene, no solo que está ocupada.
 *
 * El orden de los sectores es el que trae la consulta —`sector.sortOrder`, el
 * que el dueño acomodó— y no alfabético: "Terraza" antes que "Salón" porque
 * empieza con T sería reordenarle el local.
 */
export function agruparPorSector<T extends { sector: string | null }>(mesas: T[]): [string, T[]][] {
  const porSector = new Map<string, T[]>();
  for (const mesa of mesas) {
    // Las mesas sin sector existen: quedan así si alguien borra el sector que
    // las contenía.
    const sector = mesa.sector ?? "Sin sector";
    const actuales = porSector.get(sector);
    if (actuales) actuales.push(mesa);
    else porSector.set(sector, [mesa]);
  }
  return [...porSector.entries()];
}

export type EstadoDeMesa =
  | { tipo: "libre" }
  | { tipo: "ocupada"; detalle: string }
  | { tipo: "pendiente"; detalle: string };

/**
 * Cómo se ve una mesa en el listado.
 *
 * "pendiente" gana sobre "ocupada" por el mismo motivo que en el navbar: lo que
 * está cargado sin mandar a cocina es lo único que pide una acción.
 *
 * Y hay un caso que parece un bug y no lo es: una mesa con TRES platos sin
 * mandar muestra $0. El total de la comanda cuenta solo lo confirmado, porque
 * cobrar un borrador sería cobrar algo que la cocina nunca vio. Por eso cuando
 * hay pendientes se dice el número de platos y no la plata: el cero ahí no
 * significa "no consumió nada", significa "todavía no se pidió".
 */
export function estadoDeMesa(
  mesa: MesaParaAgrupar,
  money: (valor: number) => string,
): EstadoDeMesa {
  if (!mesa.comanda) return { tipo: "libre" };

  const { pendientes, total, items, minutosAbierta } = mesa.comanda;

  if (pendientes > 0) {
    return {
      tipo: "pendiente",
      detalle: pendientes === 1 ? "1 sin mandar" : `${pendientes} sin mandar`,
    };
  }

  return {
    tipo: "ocupada",
    detalle: `${money(total)} · ${items} ${items === 1 ? "ítem" : "ítems"} · ${minutosAbierta} min`,
  };
}
