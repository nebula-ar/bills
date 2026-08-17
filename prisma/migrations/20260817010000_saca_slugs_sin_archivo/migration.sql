-- Deshace la parte del backfill anterior que apuntaba a fotos que ya no se
-- publican.
--
-- La migración 20260817000000 rellenó `catalogSlug` para la mercadería semilla
-- de todos los rubros. De esas fotos quedaron solo las del kiosco: las otras 19
-- se sacaron del repo. Un producto que siga apuntando a un archivo que no
-- existe pide una imagen que devuelve 404 y muestra el hueco, que es peor que
-- no tener foto — sin foto la grilla dibuja su marcador y queda prolija.
--
-- Es seguro poner estos 19 en null sin mirar nada más: son slugs que no
-- existían antes de aquella migración, así que TODO producto que los tenga los
-- recibió de ahí. No hay ninguno que los trajera de antes y se le esté sacando
-- algo suyo.
--
-- Los slugs de verdulería (banana, tomate, papa-lavada...) NO se tocan aunque
-- también los haya escrito aquella migración: esos archivos existen desde antes
-- y los comparten cientos de productos del catálogo de verdulería previos.
-- Nulearlos les sacaría una foto que siempre tuvieron.

UPDATE "Product"
SET "catalogSlug" = NULL
WHERE "catalogSlug" IN (
  'cera-modeladora',
  'shampoo',
  'crema-de-manos',
  'remera-lisa',
  'jean-clasico',
  'campera-de-abrigo',
  'zapatilla-urbana',
  'gorra',
  'ovillo-de-lana',
  'hilo-de-coser',
  'cinta-de-raso',
  'elastico-2-cm',
  'boton-nacarado',
  'tela-de-algodon',
  'martillo-carpintero',
  'cable-unipolar',
  'rollo-de-teflon',
  'tornillo-autoperforante',
  'latex-interior'
);
