/**
 * Límite de frecuencia en memoria, para los endpoints públicos del QR.
 *
 * POR QUÉ EXISTE: `publicAddItem` y compañía son server actions SIN sesión,
 * autenticadas sólo con el token de mesa del QR. Una server action es un POST:
 * cualquiera que fotografió el código puede llamarlas en bucle desde su casa.
 * Sin freno se podía crear comandas en todas las mesas de madrugada, quemar el
 * correlativo de la organización y llenar la base de OrderItem.
 *
 * ALCANCE HONESTO: el estado vive en el proceso. En Vercel cada instancia
 * serverless tiene el suyo, así que el límite real es por instancia y se pierde
 * en cada arranque en frío. Es una barrera contra el abuso casual y los bucles
 * accidentales, NO contra un atacante decidido — para eso hace falta un store
 * compartido (Redis/Upstash) o el rate limiting del borde.
 *
 * Se prefiere esto a no tener nada: hoy el costo de abusar del endpoint es cero.
 */

type Ventana = { desde: number; cuenta: number };

const ventanas = new Map<string, Ventana>();

/** Cada cuánto se limpia el mapa, para que no crezca sin techo. */
const LIMPIEZA_CADA_MS = 5 * 60_000;
let ultimaLimpieza = 0;

function limpiar(ahora: number, ventanaMs: number) {
  if (ahora - ultimaLimpieza < LIMPIEZA_CADA_MS) return;
  ultimaLimpieza = ahora;
  for (const [clave, v] of ventanas) {
    if (ahora - v.desde > ventanaMs) ventanas.delete(clave);
  }
}

export type ResultadoLimite =
  | { permitido: true; restantes: number }
  | { permitido: false; esperarMs: number };

/**
 * Registra un intento y dice si se puede seguir.
 *
 * @param clave    qué se está limitando (ej. el token de la mesa)
 * @param maximo   intentos permitidos dentro de la ventana
 * @param ventanaMs duración de la ventana
 * @param ahora    inyectable para poder testear sin esperar
 */
export function checkRateLimit(
  clave: string,
  maximo: number,
  ventanaMs: number,
  ahora: number = Date.now(),
): ResultadoLimite {
  limpiar(ahora, ventanaMs);

  const actual = ventanas.get(clave);
  if (!actual || ahora - actual.desde > ventanaMs) {
    ventanas.set(clave, { desde: ahora, cuenta: 1 });
    return { permitido: true, restantes: maximo - 1 };
  }

  if (actual.cuenta >= maximo) {
    return { permitido: false, esperarMs: ventanaMs - (ahora - actual.desde) };
  }

  actual.cuenta += 1;
  return { permitido: true, restantes: maximo - actual.cuenta };
}

/** Sólo para tests: vacía el estado entre casos. */
export function resetRateLimit() {
  ventanas.clear();
  ultimaLimpieza = 0;
}

/**
 * Límite del carrito público: 40 acciones por minuto y por mesa. Una mesa
 * pidiendo de verdad hace muchísimo menos; un bucle lo supera al instante.
 */
export const LIMITE_CARTA_PUBLICA = { maximo: 40, ventanaMs: 60_000 };
