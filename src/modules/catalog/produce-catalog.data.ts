// Catálogo canónico de verdulería.
//
// Una verdulería vende siempre lo mismo. Por eso esto viene de fábrica: el dueño
// no carga 120 productos a mano ni fotografía una banana. El `slug` es el nombre
// del archivo de imagen compartido (`public/catalog/produce/<slug>.webp`), así
// que 300 verdulerías leen la misma foto y ninguna sube nada.
//
// ORIGEN Y MANTENIMIENTO
// La lista arrancó scrapeando la taxonomía de una verdulería online
// (`scripts/scrape-produce-catalog.ts`) y después se completó a mano. Ese script
// NO regenera este archivo: un scrape es la foto de una semana, y en agosto no
// hay duraznos ni cerezas en góndola. Sirve para revisar qué apareció nuevo, no
// para pisar lo que está acá.
//
// Del origen se tomaron nombres y categorías —datos del rubro—, nunca las fotos.
//
// UNIDADES
// KG para lo que se pesa, UNIT para lo que se vende cerrado (el atado de acelga,
// la bandeja de champiñones, el morrón). La regla del rubro: las hojas y las
// aromáticas van en atado, las raíces y los frutos se pesan. Ver
// `src/lib/quantity.ts` — las cantidades se guardan en milésimas, así que un KG
// permite vender 1,250.

import { Unit } from "@/generated/prisma/enums";

import type { ProduceItem } from "./produce-catalog.logic";

const FRUTAS: ProduceItem[] = [
  { slug: "anana", name: "Ananá", unit: Unit.UNIT, category: "Frutas" },
  { slug: "arandanos", name: "Arándanos", unit: Unit.UNIT, category: "Frutas" },
  { slug: "banana", name: "Banana", unit: Unit.KG, category: "Frutas" },
  { slug: "caqui", name: "Caqui", unit: Unit.KG, category: "Frutas" },
  { slug: "cereza", name: "Cereza", unit: Unit.KG, category: "Frutas" },
  { slug: "chirimoya", name: "Chirimoya", unit: Unit.KG, category: "Frutas" },
  { slug: "ciruela", name: "Ciruela", unit: Unit.KG, category: "Frutas" },
  { slug: "damasco", name: "Damasco", unit: Unit.KG, category: "Frutas" },
  { slug: "durazno", name: "Durazno", unit: Unit.KG, category: "Frutas" },
  { slug: "frambuesa", name: "Frambuesa", unit: Unit.UNIT, category: "Frutas" },
  { slug: "frutilla", name: "Frutilla", unit: Unit.KG, category: "Frutas" },
  { slug: "granada", name: "Granada", unit: Unit.UNIT, category: "Frutas" },
  { slug: "higo", name: "Higo", unit: Unit.KG, category: "Frutas" },
  { slug: "kiwi", name: "Kiwi", unit: Unit.KG, category: "Frutas" },
  { slug: "lima", name: "Lima", unit: Unit.KG, category: "Frutas" },
  { slug: "limon", name: "Limón", unit: Unit.KG, category: "Frutas" },
  { slug: "mamon", name: "Mamón", unit: Unit.UNIT, category: "Frutas" },
  { slug: "mandarina", name: "Mandarina", unit: Unit.KG, category: "Frutas" },
  { slug: "mango", name: "Mango", unit: Unit.UNIT, category: "Frutas" },
  { slug: "manzana-roja", name: "Manzana roja", unit: Unit.KG, category: "Frutas" },
  { slug: "manzana-verde", name: "Manzana verde", unit: Unit.KG, category: "Frutas" },
  { slug: "maracuya", name: "Maracuyá", unit: Unit.UNIT, category: "Frutas" },
  { slug: "melon-amarillo", name: "Melón amarillo", unit: Unit.KG, category: "Frutas" },
  { slug: "melon-blanco", name: "Melón blanco", unit: Unit.KG, category: "Frutas" },
  { slug: "membrillo", name: "Membrillo", unit: Unit.KG, category: "Frutas" },
  { slug: "mora", name: "Mora", unit: Unit.UNIT, category: "Frutas" },
  { slug: "naranja", name: "Naranja", unit: Unit.KG, category: "Frutas" },
  // El verdulero las tiene separadas y a distinto precio: la de ombligo se come,
  // la de jugo se exprime.
  { slug: "naranja-de-jugo", name: "Naranja de jugo", unit: Unit.KG, category: "Frutas" },
  { slug: "nispero", name: "Níspero", unit: Unit.KG, category: "Frutas" },
  { slug: "pelon", name: "Pelón", unit: Unit.KG, category: "Frutas" },
  { slug: "pera", name: "Pera", unit: Unit.KG, category: "Frutas" },
  { slug: "pomelo", name: "Pomelo", unit: Unit.KG, category: "Frutas" },
  { slug: "sandia", name: "Sandía", unit: Unit.KG, category: "Frutas" },
  { slug: "sandia-baby", name: "Sandía baby", unit: Unit.KG, category: "Frutas" },
  { slug: "tuna", name: "Tuna", unit: Unit.UNIT, category: "Frutas" },
  { slug: "uvas-negras", name: "Uvas negras", unit: Unit.KG, category: "Frutas" },
  { slug: "uvas-rosadas", name: "Uvas rosadas", unit: Unit.KG, category: "Frutas" },
  { slug: "uvas-verdes", name: "Uvas verdes", unit: Unit.KG, category: "Frutas" },
];

const VERDURAS: ProduceItem[] = [
  { slug: "acelga", name: "Acelga", unit: Unit.UNIT, category: "Verduras" },
  { slug: "achicoria", name: "Achicoria", unit: Unit.UNIT, category: "Verduras" },
  { slug: "aji-picante", name: "Ají picante", unit: Unit.UNIT, category: "Verduras" },
  { slug: "ajo", name: "Ajo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "alcaucil", name: "Alcaucil", unit: Unit.UNIT, category: "Verduras" },
  { slug: "anco", name: "Anco", unit: Unit.KG, category: "Verduras" },
  { slug: "apio", name: "Apio", unit: Unit.UNIT, category: "Verduras" },
  { slug: "arveja", name: "Arveja", unit: Unit.KG, category: "Verduras" },
  { slug: "batata", name: "Batata", unit: Unit.KG, category: "Verduras" },
  { slug: "berenjena", name: "Berenjena", unit: Unit.KG, category: "Verduras" },
  { slug: "berro", name: "Berro", unit: Unit.UNIT, category: "Verduras" },
  { slug: "boniato", name: "Boniato", unit: Unit.KG, category: "Verduras" },
  { slug: "brocoli", name: "Brócoli", unit: Unit.UNIT, category: "Verduras" },
  { slug: "brotes-de-alfalfa", name: "Brotes de alfalfa", unit: Unit.UNIT, category: "Verduras" },
  { slug: "brotes-de-rabanito", name: "Brotes de rabanito", unit: Unit.UNIT, category: "Verduras" },
  { slug: "brotes-de-soja", name: "Brotes de soja", unit: Unit.UNIT, category: "Verduras" },
  { slug: "cabutia", name: "Cabutiá", unit: Unit.KG, category: "Verduras" },
  { slug: "cardo", name: "Cardo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "cebolla", name: "Cebolla", unit: Unit.KG, category: "Verduras" },
  { slug: "cebolla-morada", name: "Cebolla morada", unit: Unit.KG, category: "Verduras" },
  { slug: "cebollita-de-verdeo", name: "Cebollita de verdeo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "champinones", name: "Champiñones", unit: Unit.UNIT, category: "Verduras" },
  { slug: "chaucha", name: "Chaucha", unit: Unit.KG, category: "Verduras" },
  { slug: "choclo", name: "Choclo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "coliflor", name: "Coliflor", unit: Unit.UNIT, category: "Verduras" },
  { slug: "echalote", name: "Echalote", unit: Unit.KG, category: "Verduras" },
  { slug: "endivia", name: "Endivia", unit: Unit.UNIT, category: "Verduras" },
  { slug: "escarola", name: "Escarola", unit: Unit.UNIT, category: "Verduras" },
  { slug: "esparrago", name: "Espárrago", unit: Unit.UNIT, category: "Verduras" },
  { slug: "espinaca", name: "Espinaca", unit: Unit.UNIT, category: "Verduras" },
  { slug: "girgolas", name: "Gírgolas", unit: Unit.UNIT, category: "Verduras" },
  { slug: "haba", name: "Haba", unit: Unit.KG, category: "Verduras" },
  { slug: "hinojo", name: "Hinojo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "jengibre", name: "Jengibre", unit: Unit.UNIT, category: "Verduras" },
  { slug: "kale", name: "Kale", unit: Unit.UNIT, category: "Verduras" },
  { slug: "lechuga-capuchina", name: "Lechuga capuchina", unit: Unit.UNIT, category: "Verduras" },
  { slug: "lechuga-criolla", name: "Lechuga criolla", unit: Unit.UNIT, category: "Verduras" },
  { slug: "lechuga-francesa", name: "Lechuga francesa", unit: Unit.UNIT, category: "Verduras" },
  { slug: "lechuga-mantecosa", name: "Lechuga mantecosa", unit: Unit.UNIT, category: "Verduras" },
  { slug: "lechuga-morada", name: "Lechuga morada", unit: Unit.UNIT, category: "Verduras" },
  { slug: "morron-amarillo", name: "Morrón amarillo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "morron-rojo", name: "Morrón rojo", unit: Unit.UNIT, category: "Verduras" },
  { slug: "morron-verde", name: "Morrón verde", unit: Unit.UNIT, category: "Verduras" },
  { slug: "nabo", name: "Nabo", unit: Unit.KG, category: "Verduras" },
  // Botánicamente es fruta, pero en la verdulería vive con las verduras y así la
  // busca el que atiende.
  { slug: "palta", name: "Palta", unit: Unit.UNIT, category: "Verduras" },
  { slug: "papa-blanca", name: "Papa blanca", unit: Unit.KG, category: "Verduras" },
  { slug: "papa-lavada", name: "Papa lavada", unit: Unit.KG, category: "Verduras" },
  { slug: "papa-negra", name: "Papa negra", unit: Unit.KG, category: "Verduras" },
  { slug: "papines-andinos", name: "Papines andinos", unit: Unit.KG, category: "Verduras" },
  { slug: "pepino", name: "Pepino", unit: Unit.KG, category: "Verduras" },
  { slug: "portobellos", name: "Portobellos", unit: Unit.UNIT, category: "Verduras" },
  { slug: "puerro", name: "Puerro", unit: Unit.UNIT, category: "Verduras" },
  { slug: "rabanito", name: "Rabanito", unit: Unit.UNIT, category: "Verduras" },
  { slug: "radicchio", name: "Radicchio", unit: Unit.UNIT, category: "Verduras" },
  { slug: "radicheta", name: "Radicheta", unit: Unit.UNIT, category: "Verduras" },
  { slug: "remolacha", name: "Remolacha", unit: Unit.UNIT, category: "Verduras" },
  { slug: "repollitos-de-bruselas", name: "Repollitos de Bruselas", unit: Unit.UNIT, category: "Verduras" },
  { slug: "repollo-blanco", name: "Repollo blanco", unit: Unit.UNIT, category: "Verduras" },
  { slug: "repollo-colorado", name: "Repollo colorado", unit: Unit.UNIT, category: "Verduras" },
  { slug: "rucula", name: "Rúcula", unit: Unit.UNIT, category: "Verduras" },
  { slug: "tomate", name: "Tomate", unit: Unit.KG, category: "Verduras" },
  { slug: "tomate-cherry", name: "Tomate cherry", unit: Unit.KG, category: "Verduras" },
  { slug: "tomate-perita", name: "Tomate perita", unit: Unit.KG, category: "Verduras" },
  { slug: "zanahoria", name: "Zanahoria", unit: Unit.KG, category: "Verduras" },
  { slug: "zapallito", name: "Zapallito", unit: Unit.KG, category: "Verduras" },
  { slug: "zapallo-plomo", name: "Zapallo plomo", unit: Unit.KG, category: "Verduras" },
  { slug: "zucchini", name: "Zucchini", unit: Unit.KG, category: "Verduras" },
];

// Todas en atado o maceta: ninguna se pesa.
const AROMATICAS: ProduceItem[] = [
  { slug: "albahaca", name: "Albahaca", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "ciboulette", name: "Ciboulette", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "cilantro", name: "Cilantro", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "eneldo", name: "Eneldo", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "estragon", name: "Estragón", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "laurel", name: "Laurel", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "menta", name: "Menta", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "oregano", name: "Orégano", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "perejil", name: "Perejil", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "romero", name: "Romero", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "salvia", name: "Salvia", unit: Unit.UNIT, category: "Aromáticas" },
  { slug: "tomillo", name: "Tomillo", unit: Unit.UNIT, category: "Aromáticas" },
];

const HUEVOS: ProduceItem[] = [
  { slug: "huevos-por-docena", name: "Huevos por docena", unit: Unit.DOZEN, category: "Huevos y lácteos" },
  { slug: "huevos-media-docena", name: "Huevos por media docena", unit: Unit.UNIT, category: "Huevos y lácteos" },
  { slug: "maple-de-huevos-blanco", name: "Maple de huevos blanco", unit: Unit.UNIT, category: "Huevos y lácteos" },
  { slug: "maple-de-huevos-color", name: "Maple de huevos color", unit: Unit.UNIT, category: "Huevos y lácteos" },
  { slug: "huevos-de-codorniz", name: "Huevos de codorniz", unit: Unit.UNIT, category: "Huevos y lácteos" },
];

export const PRODUCE_CATALOG: ProduceItem[] = [...FRUTAS, ...VERDURAS, ...AROMATICAS, ...HUEVOS];

export function findProduceItem(slug: string): ProduceItem | undefined {
  return PRODUCE_CATALOG.find((item) => item.slug === slug);
}
