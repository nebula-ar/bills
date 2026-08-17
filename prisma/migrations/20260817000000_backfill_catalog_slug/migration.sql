-- Le pone la foto del catálogo a los productos que se sembraron antes de que
-- el catálogo semilla tuviera fotos.
--
-- POR QUÉ UNA MIGRACIÓN Y NO ARREGLAR LA IMPORTACIÓN
-- `seedPresetCatalog` escribe `catalogSlug` sólo al CREAR, y saltea por nombre
-- lo que ya existe. Pero además la pantalla que la dispara sólo aparece con el
-- catálogo vacío (ver catalog-manager.tsx): un negocio que ya cargó sus
-- productos no puede volver a llamarla ni queriendo. Corregir la importación
-- habría sido código muerto justo para los negocios afectados.
--
-- POR QUÉ LOS PARES VAN ESCRITOS ACÁ Y NO LEÍDOS DE vertical.ts
-- Una migración es una foto de un momento. Si mañana el catálogo semilla
-- renombra un producto o le cambia el slug, esta migración TIENE que seguir
-- haciendo lo que hacía el día que corrió, porque en las bases donde ya corrió
-- no vuelve a ejecutarse. Leer el catálogo vivo la haría cambiar de
-- comportamiento según cuándo se aplique.
--
-- Sólo rellena lo que está en null: si un producto ya apunta a una foto, esa
-- decisión es más nueva que esta migración y no se pisa.

WITH seed(vertical, name, slug) AS (
  VALUES
    ('BARBERSHOP', 'Cera modeladora', 'cera-modeladora'),
    ('BARBERSHOP', 'Shampoo', 'shampoo'),
    ('KIOSK', 'Alfajor triple', 'alfajor-triple'),
    ('KIOSK', 'Chicles', 'chicles'),
    ('KIOSK', 'Gaseosa 500 ml', 'gaseosa-500-ml'),
    ('KIOSK', 'Agua saborizada 1,5 L', 'agua-saborizada'),
    ('KIOSK', 'Papas fritas', 'papas-fritas'),
    ('KIOSK', 'Atado de cigarrillos', 'atado-de-cigarrillos'),
    ('GROCERY', 'Banana', 'banana'),
    ('GROCERY', 'Manzana roja', 'manzana-roja'),
    ('GROCERY', 'Tomate', 'tomate'),
    ('GROCERY', 'Papa', 'papa-lavada'),
    ('GROCERY', 'Lechuga', 'lechuga-criolla'),
    ('GROCERY', 'Huevos por docena', 'huevos-por-docena'),
    ('CLOTHING', 'Remera lisa', 'remera-lisa'),
    ('CLOTHING', 'Jean clásico', 'jean-clasico'),
    ('CLOTHING', 'Campera de abrigo', 'campera-de-abrigo'),
    ('CLOTHING', 'Zapatilla urbana', 'zapatilla-urbana'),
    ('CLOTHING', 'Gorra', 'gorra'),
    ('HABERDASHERY', 'Ovillo de lana', 'ovillo-de-lana'),
    ('HABERDASHERY', 'Hilo de coser', 'hilo-de-coser'),
    ('HABERDASHERY', 'Cinta de raso', 'cinta-de-raso'),
    ('HABERDASHERY', 'Elástico 2 cm', 'elastico-2-cm'),
    ('HABERDASHERY', 'Botón nacarado', 'boton-nacarado'),
    ('HABERDASHERY', 'Tela de algodón', 'tela-de-algodon'),
    ('BEAUTY', 'Crema de manos', 'crema-de-manos'),
    ('HARDWARE', 'Martillo carpintero', 'martillo-carpintero'),
    ('HARDWARE', 'Cable unipolar 2,5 mm', 'cable-unipolar'),
    ('HARDWARE', 'Rollo de teflón', 'rollo-de-teflon'),
    ('HARDWARE', 'Tornillo autoperforante', 'tornillo-autoperforante'),
    ('HARDWARE', 'Látex interior 4 L', 'latex-interior'),
    ('BAKERY', 'Pan de Queso', 'pan-de-queso'),
    ('BAKERY', 'Milonguita', 'milonguita'),
    ('BAKERY', 'Pan Del Abuelo', 'pan-del-abuelo'),
    ('BAKERY', 'Medialuna', 'medialuna'),
    ('BAKERY', 'Docena de medialunas', 'docena-de-medialunas'),
    ('BAKERY', 'Cremona', 'cremona'),
    ('BAKERY', 'Alfajor de Maicena', 'alfajor-de-maicena'),
    ('BAKERY', 'Pepas de Membrillo', 'pepas-de-membrillo'),
    ('BAKERY', 'Americano', 'cafe-americano'),
    ('BAKERY', 'Capuccino', 'capuccino')
)
-- `Business` va como relación suelta del FROM y no como JOIN: en un
-- `UPDATE ... FROM`, Postgres no deja referenciar la tabla que se actualiza
-- ("p") dentro de la condición de un JOIN. La misma consulta escrita como
-- SELECT sí lo permite, y por eso el ensayo previo no lo detectó.
UPDATE "Product" p
SET "catalogSlug" = s.slug
FROM seed s, "Business" b
WHERE b.id = p."businessId"
  AND p."catalogSlug" IS NULL
  AND b.vertical::text = s.vertical
  AND lower(p.name) = lower(s.name);
