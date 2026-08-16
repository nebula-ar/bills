-- Stock ideal por producto: a cuánto se quiere volver al reponer, en milésimas
-- (misma escala que `minStock`, ver src/lib/quantity.ts).
--
-- Es otra pregunta que el mínimo: `minStock` dice CUÁNDO comprar, éste dice
-- CUÁNTO. Nullable y sin default a propósito: la mayoría de los rubros no lo
-- usa, y un default numérico haría que la app muestre un objetivo que nadie
-- fijó — peor que no mostrar nada.
ALTER TABLE "Product" ADD COLUMN "idealStock" INTEGER;
