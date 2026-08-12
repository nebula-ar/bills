<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bills — convenciones del proyecto

Sistema de gestión para comercios chicos. **Un solo core para todos los rubros**
(barbería, kiosco, verdulería, mercería, ropa, ferretería): lo que cambia por rubro
es qué módulos están prendidos y cómo se llaman las cosas, nunca la lógica de
negocio. Ver el README para el panorama completo.

## Invariantes que no se rompen

- **Plata**: enteros en pesos, sin centavos (`src/lib/money.ts`).
- **Cantidades**: enteros en **milésimas** de unidad (`1 unidad = 1000`), para poder
  vender 1,250 kg. Todo pasa por `src/lib/quantity.ts`; `lineTotal()` es el único
  lugar donde se redondea.
- **Stock**: `StockMovement` es append-only y `StockLevel` es un caché derivado. Las
  dos escrituras van **siempre en la misma transacción** (`applyStockMovement`).
  Nunca se pisa una existencia a mano.
- **El inventario se valúa a promedio ponderado (PPP), no a último costo**
  (`costing.logic.ts`). `StockLevel.avgCost` es por sucursal y se recalcula solo
  en las ENTRADAS; las salidas sacan al promedio vigente. Es distinto de
  `Product.cost`, que es el costo de **reposición** (lo último que se pagó,
  sirve para fijar precio) y que una factura vieja no puede pisar. Valuar 100
  unidades compradas a $1.000 al precio de las 10 que entraron ayer a $1.500
  inventa $50.000 de patrimonio y encarece el costo de lo vendido.
- **Anular revierte, no borra**: se asientan movimientos compensatorios.
- **Una venta se graba en una sola transacción**: renglones, pagos, descuentos,
  stock y fiado. O entra todo, o nada.
- **El fiado (`PaymentMethod.ACCOUNT`) no entra a la caja**: genera deuda del
  cliente. Impacta en caja recién cuando el cliente paga.
- **Una compra a proveedor es la misma historia del otro lado**: la `Purchase`
  es deuda, no gasto, y toca la caja recién con cada `PurchasePayment`. Por eso
  el mes de Gastos suma **gastos + pagos**, nunca el total de una factura
  (`outflow.logic.ts`): si sumara las dos cosas, una factura en tres cuotas
  aparecería contada dos veces. Proveedores no tiene pantalla propia —vive
  dentro de Gastos, porque para el dueño es todo "plata que sale"— y el módulo
  `SUPPLIERS` no se sostiene solo: `MODULE_REQUIRES` lo ata a `EXPENSES`.
- **Caja y ganancia son dos preguntas distintas y no se mezclan.** Comprar
  mercadería saca plata de la caja pero **no es un gasto**: es cambiar plata por
  stock, y recién se vuelve costo cuando se vende. Entonces: lo que dice "salió"
  (caja, arqueo, total del mes en Gastos) cuenta **todo**; lo que dice "gasto" o
  "ganancia" (dashboard) deja afuera la mercadería —la categoría `MERCHANDISE` y
  las compras a proveedor— y descuenta el costo con la venta, vía
  `SaleItem.unitCost`, que se congela al vender justamente para esto
  (`profit.logic.ts`). Lo no vendido no se pierde de vista: se muestra como
  patrimonio ("En mercadería" = promedio ponderado × existencia). Si un producto
  se vendió sin costo cargado, la ganancia queda inflada y **hay que decirlo en
  pantalla**, nunca inventar un costo ni disimular el hueco. Ojo: un servicio
  sin costo no es un hueco —un corte de pelo no tiene costo de mercadería— así
  que solo avisa lo que lleva `trackStock`.
- **Todo lo que sale tiene que caer en algún lado del resultado.** Una factura
  de proveedor que no es mercadería (`Purchase.expenseCategory`) es gasto
  operativo devengado a `issuedAt`; la merma y los faltantes de conteo son
  pérdida del período valuada al costo con el que salieron. Si algo baja el
  stock o la caja y no aparece en la ganancia, es un agujero: por ahí se escapa
  un robo sin que el resultado se entere.
- **El rubro no condiciona la lógica**: solo etiquetas (`src/lib/vertical.ts`) y
  módulos habilitados (`src/lib/app-modules.ts`).
- **Cada rubro declara qué herramientas se le muestran** (`VerticalFeatures`:
  talles, códigos de barras, bultos, página pública). No se pregunta por el rubro en el JSX
  (`if (vertical === CLOTHING)`), se lee la feature. Un botón de "modelo con
  talles" en una verdulería no es solo ruido: es una invitación a cargar mal los
  datos, y el error aparece después en el stock.
- **Una acción que muta y se queda en la misma ruta devuelve resultado, y el
  cliente llama `router.refresh()`**. El `redirect()` con flash en la URL NO
  vuelve a pedir el árbol: la pantalla se queda con los datos de antes aunque la
  base ya esté escrita (reproducible al 100% al prender la página pública en
  `/marketing`; es también la causa de los ajustes de stock que "no se
  aplicaban"). El POS usa este patrón desde siempre y es el único que nunca
  falló. Si igual se redirige, `revalidatePath` es obligatorio pero no alcanza.
- **Un link público se autoriza por token random, nunca por id**: el presupuesto
  en `/p/<token>` y la página del negocio en `/n/<token>` no tienen sesión, así
  que el token ES la credencial. Todo lo que llega de ahí se revalida en el
  servidor (que el negocio exista, que la página esté prendida, que la sucursal
  y el empleado sean de ese negocio): del navegador no se cree nada.
- **Los mensajes a clientes se mandan de a uno, desde el WhatsApp del dueño.**
  Nada de envío masivo automático: 200 mensajes de golpe hacen que le bloqueen
  el número, y el número es su negocio.

## Estructura de un módulo (`src/modules/<nombre>/`)

- `*.repository.ts` — acceso a datos (Prisma). Sin reglas de negocio.
- `*.use-case.ts` — casos de uso: validan, orquestan, loguean.
- `*.logic.ts` — lógica pura y testeable: sin Prisma y **sin `new Date()` implícito**
  (el "ahora" entra por parámetro). Acá van los tests unitarios.
- `*.errors.ts` — códigos de error tipados.

Los mensajes para el usuario **no** viven en el dominio: van en
`src/lib/*-error-messages.ts`.

## Pantallas

- **Lo de una cosa se resuelve donde está esa cosa.** Si el usuario ya tiene el
  producto abierto, no se le vuelve a pedir que lo elija: las operaciones de
  stock de un producto viven en su ficha, no en otra pantalla con un `select`.
  El usuario que tenemos en la cabeza no es un cajero entrenado: es alguien que
  abre la app por primera vez y no debería tener que aprender por dónde se va.


- Página server component + `actions.ts` con server actions.
- Las que dependen de un módulo usan `requireModule(AppModule.X)`, para que no se
  pueda entrar por URL a algo que el negocio tiene apagado.
- Los flash de las acciones viajan por query (`?status=&message=`) y los muestra
  `FlashToaster`.
- Piezas de UI compartidas para pantallas de gestión: `src/components/manager-ui.tsx`.
- **Importante**: el código que llega al navegador debe importar enums desde
  `@/generated/prisma/enums`, nunca desde `@/generated/prisma/client` (eso arrastra
  el cliente de Prisma al bundle y rompe el build).

## Antes de dar algo por terminado

`npx tsc --noEmit` · `npm test` · `npm run build`
