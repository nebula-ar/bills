// Precios de REFERENCIA del catálogo de verdulería, en pesos enteros.
//
// Existen para que el negocio pueda vender el mismo día que carga el catálogo:
// sin precio el producto no llega al mostrador, y pedirle a alguien que tipee
// 122 valores antes de cobrar la primera venta es no darle nada.
//
// PERO SON UNA REFERENCIA, NO UN PRECIO.
// Con la inflación de acá quedan viejos en semanas, y cada verdulería compra a
// distinto proveedor. Por eso el botón dice "Cargar y revisar precios": el
// segundo verbo es parte del trato.
//
// Están anclados a los seis que ya vivían en `vertical.ts` (banana 2400/kg,
// manzana roja 3200/kg, tomate 2900/kg, papa 1600/kg, lechuga 1800/unidad,
// huevos 5200/docena) y el resto se derivó por precio relativo: lo que sale más
// que una papa y menos que una frutilla. Última revisión: agosto 2026.
//
// Van separados de `produce-catalog.data.ts` a propósito. Los nombres, las
// unidades y las categorías son taxonomía y no cambian; los precios envejecen.
// Mezclarlos obligaría a tocar el catálogo cada vez que se actualiza un número.
//
// El COSTO no se siembra. Inventarlo desfigura la ganancia en silencio, y la app
// ya sabe avisar en pantalla cuando se vendió algo sin costo cargado: es
// preferible el aviso a un número inventado.
export const PRODUCE_REFERENCE_PRICES: Record<string, number> = {
  // ── Frutas (por kg salvo las que van por unidad) ───────────────────────────
  anana: 4500,
  arandanos: 6500,
  banana: 2400,
  caqui: 3800,
  cereza: 12000,
  chirimoya: 6000,
  ciruela: 3600,
  damasco: 4200,
  durazno: 3800,
  frambuesa: 7500,
  frutilla: 6500,
  granada: 3000,
  higo: 6800,
  kiwi: 5500,
  lima: 3600,
  limon: 2600,
  mamon: 4800,
  mandarina: 2400,
  mango: 2500,
  "manzana-roja": 3200,
  "manzana-verde": 3400,
  maracuya: 3200,
  "melon-amarillo": 3000,
  "melon-blanco": 3000,
  membrillo: 3200,
  mora: 7000,
  naranja: 1800,
  "naranja-de-jugo": 1500,
  nispero: 4500,
  pelon: 4000,
  pera: 3200,
  pomelo: 2200,
  sandia: 1800,
  "sandia-baby": 2400,
  tuna: 2200,
  "uvas-negras": 4800,
  "uvas-rosadas": 5000,
  "uvas-verdes": 4600,

  // ── Verduras ───────────────────────────────────────────────────────────────
  acelga: 1500,
  achicoria: 1600,
  "aji-picante": 2500,
  ajo: 700,
  alcaucil: 1800,
  anco: 2200,
  apio: 1800,
  arveja: 5000,
  batata: 2200,
  berenjena: 3000,
  berro: 1500,
  boniato: 2400,
  brocoli: 2600,
  "brotes-de-alfalfa": 1800,
  "brotes-de-rabanito": 1900,
  "brotes-de-soja": 2000,
  cabutia: 2200,
  cardo: 2200,
  cebolla: 1800,
  "cebolla-morada": 2600,
  "cebollita-de-verdeo": 1200,
  champinones: 3500,
  chaucha: 4500,
  choclo: 1200,
  coliflor: 2800,
  echalote: 5500,
  endivia: 3200,
  escarola: 1900,
  esparrago: 5500,
  espinaca: 1800,
  girgolas: 4000,
  haba: 4200,
  hinojo: 2000,
  jengibre: 3500,
  kale: 2200,
  "lechuga-capuchina": 1800,
  "lechuga-criolla": 1800,
  "lechuga-francesa": 2000,
  "lechuga-mantecosa": 2000,
  "lechuga-morada": 2200,
  "morron-amarillo": 1800,
  "morron-rojo": 1800,
  "morron-verde": 1200,
  nabo: 2000,
  palta: 1800,
  "papa-blanca": 1600,
  "papa-lavada": 1900,
  "papa-negra": 1400,
  "papines-andinos": 3600,
  pepino: 2800,
  portobellos: 4500,
  puerro: 1800,
  rabanito: 1400,
  radicchio: 3000,
  radicheta: 1600,
  remolacha: 1600,
  "repollitos-de-bruselas": 4500,
  "repollo-blanco": 1600,
  "repollo-colorado": 2000,
  rucula: 1800,
  tomate: 2900,
  "tomate-cherry": 5000,
  "tomate-perita": 2700,
  zanahoria: 1600,
  zapallito: 2600,
  "zapallo-plomo": 1600,
  zucchini: 2800,

  // ── Aromáticas (todas por atado, precio de atado chico) ────────────────────
  albahaca: 1100,
  ciboulette: 1100,
  cilantro: 900,
  eneldo: 1100,
  estragon: 1300,
  laurel: 900,
  menta: 1000,
  oregano: 1000,
  perejil: 900,
  romero: 1100,
  salvia: 1200,
  tomillo: 1100,

  // ── Huevos ─────────────────────────────────────────────────────────────────
  "huevos-por-docena": 5200,
  "huevos-media-docena": 2800,
  "maple-de-huevos-blanco": 12000,
  "maple-de-huevos-color": 12500,
  "huevos-de-codorniz": 3500,
};
