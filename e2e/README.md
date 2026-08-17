# E2E de Productos

## Antes de correrlos, leé esto

**Estos tests escriben en la base de producción.** El `.env` del proyecto apunta
a Supabase, así que el server local y `169.58.128.104` comparten los datos: no
hay una base de pruebas separada.

Se decidió correrlos igual, con tres defensas:

1. Todo lo que crean lleva el prefijo `E2E-`.
2. Se barre al **empezar** (por las corridas que se cayeron) y al **terminar**.
3. La limpieza solo puede borrar filas cuyo nombre empiece con ese prefijo. No
   hay un `DELETE` sin filtro en ningún lado, y no tiene que haberlo nunca.

Si el teardown no logra dejar la base limpia, **falla a propósito** y te dice
qué quedó, porque son filas en el catálogo real que alguien tiene que sacar.

Ningún test toca un producto que no haya creado él mismo. Uno que edite algo
preexistente está mal escrito: el día que le cambies el nombre a un producto, el
test se cae — y peor, mientras tanto le estuvo pisando el precio.

## Configuración

Poné las credenciales de un usuario admin en `.env.local` (ya está ignorado por
git):

```
E2E_EMAIL=vos@tunegocio.com
E2E_PASSWORD=...
```

La primera vez, bajá el navegador:

```bash
npx playwright install chromium
```

## Correrlos

```bash
npm run test:e2e
```

Con interfaz, para verlos paso a paso:

```bash
npm run test:e2e:ui
```

Un solo archivo:

```bash
npx playwright test e2e/catalog.spec.ts
```

## Cómo está armado

| Archivo | Qué hace |
| --- | --- |
| `playwright.config.ts` | Apunta a localhost, carga los `.env`, define los proyectos `escritorio` y `mobile`. |
| `support/nombres.ts` | El prefijo y los nombres únicos. **No importa la base**: es lo único que pueden usar los specs. |
| `support/limpieza.ts` | El borrado, con `pg` crudo. Solo lo usan el setup y el teardown globales. |
| `support/catalogo.ts` | Los gestos de la pantalla: dar de alta, buscar, abrir la ficha. |
| `auth.setup.ts` | Se loguea una vez y guarda las cookies para los demás. |
| `catalog.spec.ts` | Los flujos de escritorio. |
| `catalog.mobile.spec.ts` | Lo que solo se rompe en un teléfono. |

`support/nombres.ts` y `support/limpieza.ts` están separados a propósito. Antes
eran un solo archivo, así que cualquier spec arrastraba el cliente de Postgres y
un `DELETE` a mano quedaba a una línea de distancia. Con la base apuntando a
producción, ese es justo el accidente que no puede pasar.

## Corren en serie

`workers: 1` y `fullyParallel: false`. Comparten el mismo negocio, y los totales
de arriba de la grilla suman **todo** lo que hay: dos specs creando productos a
la vez se pisan esos números, y el fallo se lee como un bug de la pantalla
cuando en realidad es un choque entre tests.
