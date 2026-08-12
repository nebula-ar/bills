# Bills

Sistema de gestión para comercios chicos de Argentina: **vender, controlar el stock,
manejar la caja, pagarle a los proveedores y saber cuánto te deben**.

Un mismo sistema le sirve a una barbería, un kiosco, una verdulería, una mercería,
un local de ropa o una ferretería. No hay una app por rubro: hay un core común y
cada negocio **prende los módulos que usa**.

---

## La idea: un core, muchos rubros

Todos estos negocios tienen el mismo problema de fondo (cobrar, saber qué entra y
qué sale) y aristas propias (uno vende por kilo, otro fía, otro necesita saber qué
factura vence el martes). En vez de forkear el producto por rubro, el sistema tiene:

| Pieza | Qué define | Dónde vive |
| --- | --- | --- |
| **Rubro** (`Vertical`) | Punto de partida: qué módulos vienen prendidos, cómo se llaman las cosas y con qué catálogo arranca | `src/lib/vertical.ts` |
| **Módulos** (`AppModule`) | Qué existe para ese negocio. Un módulo apagado desaparece del menú y sus pantallas dejan de ser accesibles | `src/lib/app-modules.ts`, `src/modules/business/` |
| **Core** | Ventas, catálogo, sucursales, empleados, reportes. Igual para todos | `src/modules/` |

El rubro **nunca condiciona la lógica de negocio**: una venta se cobra igual en una
barbería que en un kiosco. Solo cambia el vocabulario (`Servicios` vs `Productos`,
`Barbero` vs `Vendedor`) y qué módulos se ven.

### Rubros incluidos

Barbería/peluquería · Estética · Local de ropa · Kiosco · Verdulería/fiambrería ·
Mercería/bazar · Ferretería · Otro comercio.

### Módulos activables

`STOCK` · `SUPPLIERS` (cuentas a pagar) · `PROMOTIONS` · `CUSTOMERS` (cuenta
corriente / fiado) · `CASH` · `EXPENSES` · `INVOICING` (AFIP/ARCA) · `TERMINALS` ·
`STAFF_COMMISSIONS` · `APPOINTMENTS` (agenda) · `QUOTES` (presupuestos) ·
`MARKETING` (recuperar clientes, cumpleaños, puntos y página pública).

Se prenden y apagan desde **Módulos** (`/settings`). Apagar no borra datos: los
esconde.

**Exportar** (`/exportar`) no tiene módulo: todo negocio le tiene que dar algo al
contador. Ventas, gastos y compras salen en CSV separado por `;` y con BOM, que
es lo único que el Excel en español abre bien.

---

## Decisiones que conviene conocer antes de tocar el código

**La plata son enteros en pesos, sin centavos.** Ver `src/lib/money.ts`.

**El producto y su existencia se resuelven en el mismo lugar.** Para quien
atiende son una sola cosa: cargás el producto y decís cuántos tenés, en el mismo
formulario; y cuando lo abrís, ves lo que queda y podés contar, cargar o
descontar sin salir de la ficha. `/stock` quedó para lo que sí es de conjunto —
qué falta reponer, el libro de movimientos y los traspasos entre sucursales—.
Antes había que ir a otra pantalla y volver a buscar el producto en un `select`
de doscientos: justo el que ya estabas mirando.

**Marketing es leer los datos que ya están.** El negocio ya sabe quién compró,
cuándo y cuánto: `/marketing` lo usa para decir a quién escribirle hoy —el que
hace 60 días que no vuelve, el que cumple años, el que más gastó— con el mensaje
listo para mandar por WhatsApp. Los puntos se suman solos en la venta (dentro de
la misma transacción, así no pueden existir sin ella) y se canjean como crédito
en la cuenta del cliente. La página pública (`/n/<token>`) es lo único pensado
para traer gente nueva: en barbería toma reservas, en ferretería muestra el
catálogo y arma el pedido por WhatsApp.

**Cada rubro declara qué herramientas le sirven**, igual que declara sus módulos.
`VerticalFeatures` (`src/lib/vertical.ts`) dice si ese rubro maneja talles,
códigos de barras y bultos: una barbería no ve el lector porque un corte de pelo
no tiene código, y una verdulería no ve "modelo con talles". Las pantallas leen
la feature; nunca preguntan por el rubro.

**Un presupuesto no es una venta, pero se convierte en una.** Vive en su propia
tabla (`Quote`), tiene vencimiento —un precio sin fecha es una trampa para quien
lo firmó— y un `publicToken` random que es la única credencial del link que el
cliente abre desde WhatsApp (`/p/<token>`, sin sesión). Vencido no se bloquea:
se avisa. Cobrar desde el presupuesto precarga el POS y lo marca convertido.

**Los talles son productos, no atributos.** Un modelo con talles es una
`ProductFamily` y cada talle un `Product` con su código de barras y su stock,
que es como funciona en la realidad. El generador (`variants.logic.ts`) es lo
que evita cargar quince remeras a mano; la app los muestra agrupados.

**El bulto es un atajo de carga, no otra unidad.** `Product.packSize` sólo hace
que un toque sume N unidades al carrito. El stock se sigue llevando en unidades
sueltas, porque una caja abierta se vende de a uno.

**Las cantidades son enteros en milésimas de unidad.** Una verdulería vende 1,250 kg
y una mercería 2,5 m; con punto flotante los totales no cierran. `1 unidad = 1000`.
Todo lo que convierte, formatea o multiplica cantidades pasa por
`src/lib/quantity.ts` (`lineTotal()` es el único lugar donde se redondea, para que la
suma de los renglones siempre coincida con el total de la venta).

**El stock es un libro, no un contador.** `StockMovement` es append-only y
`StockLevel` es un caché derivado que se actualiza *en la misma transacción*. Nunca
se pisa una existencia a mano: un conteo distinto asienta la diferencia como ajuste.

**Anular no borra: revierte.** Anular una venta devuelve el stock y compensa el fiado
con un asiento contrario. El libro sigue contando toda la historia.

**Una venta es un solo acto.** `createSaleTransaction` graba renglones, pagos,
descuentos aplicados, salida de stock y cargo en cuenta corriente en una
transacción. O entra todo, o no entra nada.

**El fiado no es plata en la caja.** `PaymentMethod.ACCOUNT` no suma al arqueo:
genera deuda del cliente. La plata entra recién cuando la paga, y ahí sí impacta en
la caja de la sucursal donde se cobró.

**Un renglón lo descuenta una sola promo.** El motor (`promotion.logic.ts`) recorre
las promos por prioridad y la primera que agarra un renglón se lo queda. Sin esa
regla, dos promos superpuestas dejan un total en cero y nadie entiende por qué.

**El POS muestra el total definitivo antes de cobrar.** El checkout llama a
`previewSale`, que corre *el mismo* motor de promociones que la venta real.

**Las fotos de productos se guardan en la base, no en un servicio externo.** Lo
que se guarda no es lo que subieron: al llegar se recorta y reencoda a una
miniatura de 512px en WebP (2-5 KB), porque en el mostrador se ve a 150px. Con
ese tamaño, un catálogo de mil productos ocupa unos pocos MB y el sistema no
depende de ninguna cuenta de terceros — importa para un comercio chico que solo
quiere que funcione. Los bytes viven en una tabla aparte (`ProductImage`) para
que ningún listado los arrastre, y se sirven por `/api/products/[id]/image` con
caché inmutable. Si algún día el volumen lo pide, se cambia el cuerpo de
`product-image.use-case.ts` por object storage sin tocar el resto.

---

## Arquitectura

```
src/
  app/          Rutas (App Router). Cada pantalla: page.tsx + actions.ts (server actions)
  components/   UI. `manager-ui.tsx` tiene las piezas compartidas de las pantallas de gestión
  lib/          Reglas transversales: dinero, cantidades, rubros, módulos, etiquetas y errores
  modules/      Dominio, un directorio por módulo:
                  *.repository.ts  acceso a datos (Prisma)
                  *.use-case.ts    casos de uso (orquestan y validan)
                  *.logic.ts       lógica pura y testeable (sin Prisma ni fechas implícitas)
                  *.errors.ts      códigos de error tipados
prisma/         schema PostgreSQL único + migraciones + seed
supabase/       stack local efímero para desarrollo/CI
```

Los mensajes de error para el usuario **no** viven en el dominio: los casos de uso
tiran códigos tipados y `src/lib/*-error-messages.ts` los traduce.

### Base de datos

PostgreSQL 17 es el único motor en desarrollo, CI y producción. Supabase Auth
administra credenciales y refresh tokens; Bills conserva roles, negocio y permisos,
vinculados exclusivamente por `authUserId` y metadata de servidor.

---

## Empezar

```bash
npm install
cp .env.example .env
npx supabase start      # Supabase local en Docker
npm run db:migrate      # aplica las migraciones PostgreSQL
npm run db:seed         # datos de demo (un kiosco con todos los módulos)
npm run dev
```

Usuario de demo: `owner@bills.local` / `admin123`.
PINs de empleados: Nico 1111 · Lucas 2222 · Fede 3333 · Matías 4444 · Franco 5555 · Nahuel 6666.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests unitarios (lógica pura) |
| `npm run lint` | ESLint |
| `npm run db:reset` | Recrea el schema de una base PostgreSQL de desarrollo |
| `npm run db:studio` | Prisma Studio |

## Tests

- **Unitarios (`vitest`)**: cubren la lógica pura — cantidades y redondeo, motor de
  promociones, saldos de caja, vencimientos de cuentas a pagar, CUIT y facturación.
