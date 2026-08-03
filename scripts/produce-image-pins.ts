// Imágenes elegidas a mano, por si la búsqueda automática le erra.
//
// La automática resuelve la mayoría, pero no todas: Wikimedia Commons mezcla
// fotos de producto con láminas botánicas del 1800, pliegos de herbario, fotos
// de fitopatología y material histórico. Buscando "repollo colorado" llegó a
// bajar una oruga; buscando "papa blanca", una placa grabada de 1914.
//
// Acá se fija el archivo exacto de Commons para esos casos. Gana sobre todo lo
// demás. El valor es el título completo de la página, tal como figura en
// Commons, incluyendo el prefijo `File:`.
//
// Para agregar uno: buscá la foto en commons.wikimedia.org, copiá el título de
// la página y pegalo acá. Después `npx tsx scripts/fetch-produce-images.ts --force`.
export const PRODUCE_IMAGE_PINS: Record<string, string> = {};
