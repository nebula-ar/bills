/**
 * Cómo se nombra todo lo que crean los e2e.
 *
 * Este archivo NO importa la base a propósito, y los specs solo pueden importar
 * de acá. Antes `nombreDePrueba` vivía junto al borrado, así que cualquier spec
 * arrastraba el cliente de Postgres: un `deleteMany` a mano desde un test
 * quedaba a una línea de distancia, y ese es exactamente el accidente que no
 * puede pasar cuando la base es la de producción.
 *
 * El borrado vive en `limpieza.ts` y lo usan únicamente el global setup y el
 * teardown.
 */

/**
 * El prefijo que marca todo lo de prueba.
 *
 * Es la única cosa que separa un producto de test de la mercadería real del
 * negocio. Cambiarlo sin barrer antes deja huérfano lo viejo para siempre.
 */
export const PREFIJO_E2E = "E2E-";

/**
 * Un nombre único para esta corrida.
 *
 * Lleva el momento y un sufijo al azar porque dos corridas en paralelo —o el
 * mismo test reintentado— chocarían contra el índice de nombre único del
 * negocio, y el fallo se leería como un bug del alta en vez de un choque entre
 * datos de prueba.
 */
export function nombreDePrueba(etiqueta: string): string {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${PREFIJO_E2E}${etiqueta}-${Date.now().toString(36)}-${azar}`;
}
