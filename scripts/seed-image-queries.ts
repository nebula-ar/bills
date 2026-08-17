// Qué se busca en Wikimedia Commons para cada mercadería del catálogo semilla
// de los rubros que no son verdulería (ver PRODUCE_IMAGE_QUERIES para esa).
//
// La diferencia con la verdulería es que acá no hay nombre científico que
// desambigüe: son objetos manufacturados. La señal que mejor funciona es el
// título del artículo de Wikipedia en español, porque el script prueba primero
// la foto de portada de ese artículo — y la portada la eligió un humano para
// representar la cosa.
//
// Donde el nombre en español lleva a otra cosa se busca en inglés a propósito:
// "Algodón" es la planta y no la tela, "Pintura" es el arte y no el balde, y
// "Papas fritas" en España son las de restaurante y no las de paquete.

export const SEED_IMAGE_QUERIES: Record<string, string> = {
  // Barbería
  "cera-modeladora": "hair styling wax pomade jar",
  "shampoo": "Champú shampoo bottle",

  // Estética
  "crema-de-manos": "hand cream lotion tube",

  // Ropa
  "remera-lisa": "Camiseta t-shirt plain",
  "jean-clasico": "Pantalón vaquero blue jeans",
  "campera-de-abrigo": "Chaqueta winter jacket coat",
  "zapatilla-urbana": "Zapatilla deportiva sneakers",
  "gorra": "Gorra de béisbol baseball cap",

  // Kiosco
  "alfajor-triple": "Alfajor argentino chocolate",
  "chicles": "Chicle chewing gum",
  "gaseosa-500-ml": "soft drink plastic bottle cola",
  "agua-saborizada": "flavored water plastic bottle",
  // En español rioplatense "papas fritas" son las dos cosas; el paquete es esta.
  "papas-fritas": "potato chips bag snack",
  "atado-de-cigarrillos": "cigarette pack",

  // Mercería
  "ovillo-de-lana": "Ovillo ball of yarn wool",
  "hilo-de-coser": "sewing thread spool",
  "cinta-de-raso": "satin ribbon roll",
  "elastico-2-cm": "elastic band sewing haberdashery",
  "boton-nacarado": "Botón indumentaria buttons clothing",
  // "Algodón" es la planta.
  "tela-de-algodon": "cotton fabric textile roll",

  // Ferretería
  "martillo-carpintero": "Martillo claw hammer tool",
  "cable-unipolar": "Cable eléctrico electrical wire copper",
  "rollo-de-teflon": "PTFE thread seal tape roll",
  "tornillo-autoperforante": "Tornillo screw fastener",
  // "Pintura" es el arte.
  "latex-interior": "paint can bucket",
};
