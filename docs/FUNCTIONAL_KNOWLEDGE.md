# Bills — mapa funcional y cobertura de diseño

> Fuente de conocimiento del producto para diseño, desarrollo y futuras sesiones de IA.
> Última revisión: 2026-08-03.

## 1. Propósito y criterio de cobertura

Bills es un sistema de gestión para comercios chicos con **un único dominio de negocio**. El rubro cambia el vocabulario, los módulos iniciales y las herramientas visibles; no cambia cómo se vende, cobra, mueve stock o calcula el resultado.

Una capacidad se considera cubierta cuando están documentados:

1. La ruta y la puerta de entrada.
2. El módulo o feature que la habilita.
3. El contexto de entrada y las decisiones del usuario.
4. El resultado funcional y contable.
5. Los estados vacío, carga, éxito, error y acceso restringido.
6. Las reglas de dominio que no se pueden romper.

### Estado de esta revisión

- **37/37 páginas reales mapeadas** en el atlas de Pencil.
- **12/12 módulos configurables** documentados con rutas y dependencias.
- **8/8 verticales iniciales** contempladas.
- **4/4 features de rubro** documentadas.
- **10 journeys críticos** trazados de punta a punta.
- **Imagen con IA**: propuesta de diseño completa para mejorar una foto existente o generar una imagen desde una descripción; todavía no implementada.

## 2. Fuentes de verdad

El orden de precedencia es:

1. Invariantes de dominio en `AGENTS.md` y lógica pura de `src/modules/**`.
2. Rutas y acciones actuales en `src/app/**`.
3. Módulos y navegación en `src/lib/app-modules.ts`.
4. Verticales, etiquetas, presets y features en `src/lib/vertical.ts`.
5. Pruebas de extremo a extremo en `e2e/*.spec.ts`.
6. Esta guía y los tableros de Pencil como representación funcional y visual.

Si el código cambia, este documento y Pencil deben actualizarse en el mismo trabajo. Este archivo explica el producto; no reemplaza las reglas ejecutables ni las pruebas.

## 3. Modelo multi-rubro

### Verticales iniciales

| Vertical | Etiqueta principal | Rasgo operativo |
| --- | --- | --- |
| `BARBERSHOP` | Barbería o peluquería | Servicios, turnos, terminales y comisiones |
| `BEAUTY` | Estética, uñas o spa | Servicios con turno, reventa y comisiones |
| `CLOTHING` | Local de ropa | Variantes por talle/color y catálogo público |
| `KIOSK` | Kiosco o drugstore | Código de barras, bultos, fiado y reposición |
| `GROCERY` | Verdulería o fiambrería | Venta por peso, merma y proveedores |
| `HABERDASHERY` | Mercería o bazar | Venta por metro, bultos y presupuestos |
| `HARDWARE` | Ferretería o corralón | Muchos SKU, venta fraccionada y presupuestos |
| `GENERAL` | Otro comercio | Base mínima ampliable con módulos |

### Features de interfaz

| Feature | Significado |
| --- | --- |
| `variants` | Modelos con talle y color. Solo se muestra cuando aporta al rubro. |
| `barcodes` | Escaneo para cargar y vender productos. |
| `packs` | Compra y venta por bulto o presentación mayorista. |
| `publicPage` | `booking`, `catalog` o `null`, según el uso público del rubro. |

Regla: el JSX consulta features. No debe preguntar por un vertical concreto para decidir herramientas.

## 4. Módulos y dependencias

| Módulo | Ruta o ubicación | Responsabilidad |
| --- | --- | --- |
| `STOCK` | `/stock` | Faltantes, movimientos, conteos y traspasos de conjunto. |
| `SUPPLIERS` | Dentro de `/expenses` | Facturas, deuda, pagos y vencimientos. Requiere `EXPENSES`. |
| `PROMOTIONS` | `/promotions` | Descuentos, 2x1 y combos aplicables a ventas. |
| `CUSTOMERS` | `/customers` | Ficha, historial, saldo y cuenta corriente. |
| `CASH` | `/caja` | Saldos por medio, transferencias y cierres. |
| `EXPENSES` | `/expenses` | Gastos operativos y compras a proveedores. |
| `INVOICING` | `/facturacion` | Datos fiscales y comprobantes AFIP. |
| `TERMINALS` | `/terminals`, `/terminal/*` | Dispositivos, acceso de equipo por PIN y cierre personal. |
| `APPOINTMENTS` | `/turnos`, `/n/[token]` | Agenda interna y reserva pública. |
| `MARKETING` | `/marketing`, `/n/[token]` | Recuperación, cumpleaños, puntos y página pública. |
| `QUOTES` | `/presupuestos*`, `/p/[token]` | Crear, compartir y convertir presupuestos. |
| `STAFF_COMMISSIONS` | `/comisiones` | Comisión por empleado sobre lo vendido. |

`SUPPLIERS → EXPENSES` es la única dependencia explícita actual. Proveedores no tiene una pantalla aislada: para el dueño vive donde ve todo lo que sale.

## 5. Inventario de rutas

### Público y autenticación

- `/` — landing pública.
- `/about` — contenido institucional.
- `/contact` — contacto público.
- `/privacy` — documento legal.
- `/login` — autenticación.
- `/register` — onboarding de negocio.
- `/p/[token]` — presupuesto público autorizado por token.
- `/n/[token]` — página pública del negocio autorizada por token.

### Inicio y ventas

- `/dashboard` — métricas, actividad, caja, patrimonio y alertas de costo.
- `/pos` — elección de sucursal para vender.
- `/sales/new` — checkout por pasos.
- `/sales` — historial, filtros, detalle y acciones posteriores.
- `/reports` — reportes por período, empleado y medio de pago.
- `/comisiones` — resumen y liquidación visual de comisiones.

### Catálogo e inventario

- `/catalog` — productos/servicios, precios, stock individual, variantes, códigos y foto.
- `/stock` — movimientos, faltantes, conteos y traspasos de conjunto.
- `/promotions` — promociones y vigencia.

### Clientes y difusión

- `/customers` — clientes, historial, saldo y cobros de cuenta.
- `/presupuestos` — listado, estado y compartir.
- `/presupuestos/nuevo` — creación de presupuesto.
- `/marketing` — página pública y acciones individuales de difusión.

### Caja y administración

- `/caja` — saldos, movimientos, transferencias y cierres.
- `/expenses` — gastos, compras, deuda y pagos a proveedores.
- `/facturacion` — configuración fiscal.
- `/exportar` — exportación de ventas, gastos y compras.

### Operación

- `/staff` — alta, sucursal, PIN, estado, permiso de cierre y comisión.
- `/branches` — sucursales y estado.
- `/turnos` — agenda y estados del turno.
- `/terminals` — terminales registradas y accesos.

### Terminal de equipo

- `/terminal` — identificación de empleado por PIN.
- `/terminal/mis-ventas` — resumen personal del día.
- `/terminal/cierre` — cierre de caja personal autorizado.

### Configuración y superadmin

- `/settings` — módulos configurables.
- `/admin` — dashboard de plataforma.
- `/admin/stores` — comercios.
- `/admin/stores/new` — alta de comercio.
- `/admin/stores/[id]` — detalle y gestión de comercio.

## 6. Journeys críticos

### 6.1 Alta de negocio y catálogo

1. Registro y autenticación.
2. Elección de rubro y nombre del negocio.
3. Aplicación del preset: etiquetas, módulos, features, categorías y catálogo inicial.
4. Si el catálogo está vacío, se ofrecen tres caminos:
   - cargar productos típicos del rubro y revisar precios;
   - escanear lo que hay en el mostrador;
   - cargar uno a mano.
5. El alta manual pide nombre, descripción opcional, precio opcional, stock opcional, costo opcional y categoría opcional.
6. La foto se gestiona después de crear el producto, desde su ficha.

### 6.2 Foto de producto

Estado implementado:

1. Abrir un producto existente.
2. Elegir o sacar una foto desde `ProductPhotoField`.
3. La carga se guarda automáticamente porque ya existe `productId`.
4. La imagen aparece en catálogo, POS y página pública cuando corresponde.
5. El escáner puede capturar o traer foto durante su propio flujo.

Extensión implementada con OpenRouter y `recraft/recraft-v4.1`:

1. Desde el campo Foto, elegir el punto de partida:
   - **Usar una foto**: sacar una, elegirla de la galería y pedir una mejora comercial.
   - **Generar desde descripción**: describir el producto sin aportar una foto.
2. Con foto, indicar el objetivo de la mejora sin alterar la identidad del producto.
3. Sin foto, reutilizar el nombre del producto, completar descripción y elegir un estilo de venta.
4. Generar una imagen por llamada cuando se parte de texto. Al regenerar, la nueva versión se agrega al historial de la sesión y las anteriores siguen seleccionables.
5. Revisar siempre el resultado; comparar original y mejorada cuando exista una foto fuente.
6. Confirmar antes de usar o reemplazar. Cancelar conserva el estado anterior.

La IA no obliga a sacar ni subir una foto, no se mezcla con el alta manual ni con el escáner y nunca guarda una generación sin confirmación explícita.

La key vive únicamente en `OPENROUTER_API_KEY`. Las alternativas descartadas no se persisten. Cada negocio dispone de cinco tandas por día y una sola generación simultánea; si la integración no está configurada, el flujo tradicional de fotos sigue funcionando sin mostrar acciones IA.

### 6.3 Venta completa

1. `/pos`: elegir sucursal válida.
2. `/sales/new`: elegir empleado y construir carrito.
3. Resolver precio por sucursal, unidad, cantidad fraccionada, bulto y stock disponible.
4. Previsualizar promociones antes de confirmar.
5. Asociar cliente cuando corresponde, especialmente para `ACCOUNT`.
6. Distribuir pagos; la suma debe coincidir con el total.
7. Confirmar en una única transacción: venta, renglones, pagos, descuentos, costo congelado, stock y deuda.
8. Refrescar la ruta y mostrar comprobante/resultado actualizado.

Anular o devolver nunca borra. Registra reversas y movimientos compensatorios.

### 6.4 Cliente y cuenta corriente

1. Buscar o crear cliente.
2. Asociarlo a la venta.
3. `PaymentMethod.ACCOUNT` genera deuda y no incrementa caja.
4. El saldo y el historial quedan visibles en su ficha.
5. Cuando el cliente paga, se reduce deuda y recién entonces entra el dinero a caja.

### 6.5 Producto y stock

1. Abrir la ficha del producto; toda operación individual conserva ese contexto.
2. Cargar entrada, salida, merma, ajuste o transferencia según corresponda.
3. Crear `StockMovement` y actualizar `StockLevel` en la misma transacción.
4. Recalcular promedio ponderado solo en entradas.
5. Valuar salidas al promedio vigente de la sucursal.

`Product.cost` es costo de reposición. `StockLevel.avgCost` es costo promedio de inventario. No son intercambiables.

### 6.6 Gastos y proveedores

1. Registrar un gasto operativo directo o una compra a proveedor dentro de `/expenses`.
2. La factura de proveedor crea deuda; no es un gasto de caja completo al emitirla.
3. Cada `PurchasePayment` reduce deuda e impacta caja.
4. Mercadería adquirida se vuelve costo cuando se vende, no cuando se compra.
5. Una compra no mercadería se devenga como gasto operativo según su categoría y fecha.

### 6.7 Caja y terminal de equipo

1. Caja consolida saldos por medio, transferencias, ingresos, egresos y cierres.
2. La terminal identifica a un empleado activo con PIN numérico de 4 a 8 dígitos.
3. El empleado ve sus ventas del día.
4. Solo puede cerrar si tiene `canCloseCash`.
5. El cierre conserva esperado, real y diferencia; no reescribe movimientos históricos.

### 6.8 Presupuesto público

1. Crear y guardar presupuesto.
2. Compartir `/p/[token]`.
3. El cliente abre el documento sin sesión mediante un token random.
4. El servidor revalida negocio y recurso.
5. La conversión reutiliza el contexto y entra al flujo de venta.

### 6.9 Marketing, catálogo público y turnos

1. Activar la página pública en `/marketing`.
2. Generar/copiar `/n/[token]` y compartir por WhatsApp.
3. `publicPage: catalog` muestra productos activos de una sucursal.
4. `publicPage: booking` muestra servicios, empleados y horarios disponibles.
5. Apagar la página invalida el enlace inmediatamente.
6. Las comunicaciones a clientes salen de a una desde el WhatsApp del dueño.

### 6.10 Administración, facturación y exportación

- Equipo: alta, sucursal, PIN, permisos, estado y comisión.
- Sucursales: nombre, dirección y estado.
- Módulos: prender/apagar capacidades y respetar dependencias.
- Facturación: configuración fiscal y estado AFIP visible, incluido error.
- Exportar: ventas, gastos y compras para control/contador.
- Superadmin: gestión de comercios separada del contexto operativo de cada negocio.

## 7. Invariantes de dominio

1. **Plata**: enteros en pesos, sin centavos.
2. **Cantidades**: enteros en milésimas; `lineTotal()` es el único redondeo monetario de cantidad.
3. **Stock**: movimientos append-only; nivel como caché derivado; ambas escrituras en una transacción.
4. **Valuación**: promedio ponderado por sucursal; cambia en entradas, no en salidas.
5. **Anulación**: revierte con compensaciones, nunca borra.
6. **Venta**: se persiste atómicamente.
7. **Fiado**: crea deuda, no caja.
8. **Compra**: crea deuda; sus pagos impactan caja. Mercadería no es gasto inmediato.
9. **Caja y ganancia**: son métricas distintas.
10. **Resultado completo**: merma, faltantes y gastos no mercadería deben aparecer en el período correcto.
11. **Costo faltante**: se informa para mercadería; no se inventa. Un servicio sin costo no es error.
12. **Multi-rubro**: etiquetas, módulos y features; nunca lógica duplicada por vertical.
13. **Mutaciones en la misma ruta**: devolver resultado y hacer `router.refresh()`.
14. **Público**: autorización por token random y revalidación completa en servidor.
15. **WhatsApp**: mensajes individuales, nunca campaña masiva automática.

## 8. Acceso y autorización

El orden conceptual de validación es:

1. Sesión y rol.
2. Negocio activo y no eliminado.
3. Módulo requerido habilitado.
4. Sucursal, empleado y recurso pertenecientes al negocio.
5. Permisos específicos, como `canCloseCash`.
6. En público, token random vigente y página/recurso habilitados.

Un módulo apagado no debe aparecer en navegación ni quedar accesible por URL. Una feature apagada no debe ofrecer controles que lleven a una carga inválida.

## 9. Estados transversales

Toda pantalla o acción relevante debe definir:

| Estado | Criterio UX |
| --- | --- |
| Vacío | Explicar qué falta y ofrecer un primer paso concreto. |
| Cargando | Bloquear duplicados y conservar el contexto visible. |
| Éxito | Confirmar el resultado y refrescar datos del servidor. |
| Error | Ser accionable y preservar lo ya cargado. |
| Deshabilitado | No ofrecer una puerta falsa a módulos o features apagados. |
| Sin acceso | Diferenciar sesión, rol, negocio, módulo y permiso. |
| Dato faltante | Advertir precio, costo o stock faltante; nunca inventar. |
| Sin cámara/escáner | Permitir carga manual y reintento. |
| Sin clipboard/HTTPS | Mostrar el enlace para copiar manualmente. |

## 10. Mapa en Pencil

Documento: `pencil-new.pen`.

### Bases existentes

- `bi8Au` — Bills · Design System.
- `dpiSC` — Bills · Route Atlas · Evidence.
- `H8vgWh` — Bills · Mobile Gallery · Evidence.
- `h5paV` — evidencia del design system.
- `kM7h4` — landing fuente.

### Capa funcional agregada

- `Rp0tO` — Bills · Functional Coverage · Routes & Modules.
- `qYZWX` — Bills · Functional Coverage · Core Journeys.
- `tKbAC` — Bills · Functional Coverage · Rules & States.

### Flujo de foto IA

- `qKQhT` — 01 Alta manual.
- `U5GfrW` — 02 Editar y mejorar foto.
- `K7TLA` — 03 Pedir mejora IA.
- `XlxpR` — 04 Confirmar mejora IA.
- `AUm5Q` — bifurcación: usar foto o generar desde descripción.
- `nqPFL` — descripción y estilo para generar sin foto.
- `HghsG` — imagen generada, regeneración con historial seleccionable y confirmación.

## 11. Pruebas que respaldan el mapa

Las suites E2E actuales cubren autenticación, onboarding, navegación, módulos, ventas, validaciones del POS, historial, devoluciones, caja, cierre de encargado, cobro rápido, catálogo vacío, producto y stock, escáner, fotos, variantes, bultos/exportación/WhatsApp, gastos, promociones indirectas, marketing, presupuestos, terminales, turnos, comisiones y dashboards.

Archivos clave: `e2e/*.spec.ts`. La existencia de una prueba no reemplaza una auditoría de estados visuales, pero ayuda a confirmar el comportamiento esperado.

## 12. Protocolo de mantenimiento

Ante una funcionalidad nueva o modificada:

1. Actualizar la lógica y sus pruebas según las invariantes del proyecto.
2. Agregar o corregir ruta, módulo, feature, journey, acceso y estados en este documento.
3. Actualizar el atlas o la capa funcional correspondiente en Pencil.
4. Marcar con claridad si algo está **implementado**, **diseñado** o **propuesto**.
5. Exportar evidencia visual cuando cambie un journey o una pantalla crítica.

No declarar “100% cubierto” si existe una ruta sin mapa, una acción sin resultado, un módulo sin puerta de acceso, un estado sin tratamiento o una regla contable que la interfaz pueda contradecir.

## 13. Limitación local conocida

Durante esta auditoría, `/catalog` no pudo compilar en el entorno local porque `@zxing/browser` y `@zxing/library` no estaban disponibles en `node_modules`. No se instalaron dependencias ni se modificó código. El flujo se verificó mediante fuentes, acciones, pruebas y el diseño existente.
