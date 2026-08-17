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
//
// La mercadería manufacturada del resto de los rubros necesita más pins que la
// verdulería, y por otro motivo: la portada del artículo de Wikipedia le erra
// feo cuando el producto no tiene artículo propio. Buscando "agua saborizada"
// bajó anticongelante; buscando "rollo de teflón", el retrato del inventor del
// Gore-Tex; buscando "remera lisa", el logo de John Wick.
export const PRODUCE_IMAGE_PINS: Record<string, string> = {
  // Barbería
  "cera-modeladora": "File:Mossimo Hair wax Pomade clear1.jpg",
  "shampoo": "File:Green shampoo bottle.jpg",

  // Estética
  "crema-de-manos": "File:Eucerin hand cream.jpg",

  // Ropa
  "remera-lisa": "File:Ringflash Tshirt Blank Template (3214240974).jpg",
  "campera-de-abrigo": "File:Polo Ralph Lauren winter jacket, red and black plaid.jpg",

  // Kiosco
  "chicles": "File:Bubble gum at the Haribo factory.jpg",
  // Las fotos de góndola y de pallet no sirven: recortadas al cuadrado del POS
  // se ve un depósito, no una botella.
  "gaseosa-500-ml": "File:Fresca2005.jpg",
  "agua-saborizada": "File:Clearly Canadian Orchard Peach.jpg",
  "papas-fritas": "File:Opened bag of Ruffles All Dressed potato chips (cropped).jpg",

  // Mercería
  "ovillo-de-lana": "File:A ball of yarn.jpg",
  "cinta-de-raso": "File:Satin Ribbons.png",
  "elastico-2-cm": "File:Defco Elastiek, met de rek die blijft.JPG",
  // "Cotton fabric" en Commons devuelve fibra cruda: parece un algodón de
  // farmacia, no una tela que se vende por metro.
  "tela-de-algodon": "File:Bolts of fabric. (15012162252).jpg",

  // Ferretería
  "martillo-carpintero": "File:Magnum 25116 claw hammer.jpg",
  "cable-unipolar": "File:Cable wires.jpg",
  "rollo-de-teflon": "File:PTFE tape.jpg",
  "latex-interior": "File:Paint bucket and brush.jpg",
};
