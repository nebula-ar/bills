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
- **Anular revierte, no borra**: se asientan movimientos compensatorios.
- **Una venta se graba en una sola transacción**: renglones, pagos, descuentos,
  stock y fiado. O entra todo, o nada.
- **El fiado (`PaymentMethod.ACCOUNT`) no entra a la caja**: genera deuda del
  cliente. Impacta en caja recién cuando el cliente paga.
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

`npx tsc --noEmit` · `npm test` · `npm run build` · `npm run e2e`
