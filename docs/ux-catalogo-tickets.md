# Tickets de UX — pantalla Productos

Salen de una revisión externa sobre las 26 capturas de `capturas/ux/`. No es una
transcripción: cada punto está contrastado contra el código, y donde la revisión
se equivoca o pide algo que rompe una regla del dominio, está dicho.

**Verificado** = lo confirmé leyendo el código, con archivo y línea.
**Propuesto** = es criterio de diseño, no un hecho.

---

## P0 — Bugs, no mejoras

### 1. Una cantidad con coma en una unidad que no la admite se pierde, y el mensaje miente

**Verificado.** El campo de cantidad usa `inputMode="decimal"` siempre
([product-stock-panel.tsx:311](../src/components/product-stock-panel.tsx#L311)), así
que el teclado del teléfono ofrece la coma incluso en unidades, paquetes y
docenas. Pero `parseQuantityInput` devuelve `null` para una fracción en esas
unidades ([quantity.ts:89](../src/lib/quantity.ts#L89)), y el panel entonces
muestra *"Tiene que ser un número mayor que cero"* — que es falso: 2,5 **es**
mayor que cero. El problema es la coma y la pantalla no lo dice.

Es el mismo hueco que ya nos mordió en el alta: una bolsa de "25,5" caía en
`null` y el producto nacía con existencia cero, en silencio.

**Hacer**
- `inputMode` sale de la unidad: `decimal` solo si la unidad admite fracción.
- El mensaje dice el problema real: *"Los huevos se cuentan de a uno: 2,5 no se
  puede."*
- Test de la lógica del mensaje, con las siete unidades del enum.

---

### 2. Cerrar la ficha descarta los cambios sin avisar

**Verificado.** `closeEdit` limpia y cierra
([catalog-manager.tsx:819](../src/components/catalog-manager.tsx#L819)); el
comentario dice *"cerrar es cerrar"*. La decisión sería defendible si la pantalla
no supiera que hay cambios — pero **lo sabe**: el pie muestra "N cambios sin
guardar", calculado por `contarCambios`.

En escritorio se pierde un tipeo. En el teléfono, donde la ficha es una hoja que
se arrastra para cerrar, se pierde sin siquiera haber apuntado a un botón.

**Hacer**
- Si `cambios > 0`, confirmar antes de cerrar. Con el número: *"Tenés 3 cambios
  sin guardar. ¿Cerrar igual?"*
- Vale para la X, para el Escape y para el arrastre del sheet.

---

### 3. Las pestañas no son pestañas para un lector de pantalla

**Verificado.** Cero `role="tab"`, `role="tablist"`, `aria-selected` y
`role="tabpanel"` en toda la pantalla. Son `<button>` sueltos: quien navega con
teclado o lector no tiene forma de saber que son un grupo, cuál está activa, ni
que las flechas deberían moverse entre ellas.

Afecta a las dos tiras: las de la ficha y las de la lista (Productos / Insumos).

**Hacer**
- Semántica completa de tabs en las dos.
- Flechas ← → para moverse, Home/End a los extremos.
- El activo no puede distinguirse solo por color.

---

## P1 — Lo que más valor agrega

### 4. Acción de movimiento en el encabezado de la ficha

**Propuesto.** Hoy anotar que llegaron 20 kilos son tres pasos: abrir el
producto, ir a Inventario, elegir la operación. Para configurar está bien; para
operar es lento, y es la queja que ya anticipamos al sacar `/mermas`.

**Hacer**
- Botón `+ Movimiento` en el encabezado, al lado del switch, que abre las cuatro
  operaciones que ya existen.
- No es una pantalla nueva ni una acción nueva: es un atajo al mismo panel.
- Solo en productos que llevan stock.

---

### 5. La ficha, pensada para el teléfono

**Propuesto, y es donde más riesgo hay.** Las capturas son de escritorio. A
390px, General es nombre + switch + 5 pestañas + precio + costo + ganancia +
margen + descripción + categoría + código: scroll largo para cambiar un precio.

**Hacer**
- Encabezado fijo con nombre, disponibilidad y `+ Movimiento`.
- Pestañas con scroll horizontal, nunca en dos filas.
- Barra de acción abajo **solo cuando hay cambios**.
- Área táctil mínima de 44px en la X y en los íconos.
- Correr el recolector de capturas con el proyecto `mobile`, que ya existe en
  `playwright.config.ts`, y revisar contra esas imágenes y no contra estas.

---

### 6. Separar lo comercial de lo descriptivo en General

**Propuesto.** Hoy es una lista plana. Precio, costo, ganancia y margen ya están
agrupados en una tarjeta; descripción, categoría y código quedan sueltos abajo,
al mismo nivel visual.

**Hacer**
- Dos bloques con título: **Precio y costos** (ya está) e **Información del
  producto**.
- Lo segundo, colapsado por defecto: casi nunca se toca.

---

### 7. Producción, más cerca de la mano

**Propuesto.** El botón está en el encabezado del catálogo, que ya es bastante.
Lo que falta es que el flujo arranque por lo que el panadero tiene en la cabeza.

**Hacer**
- Buscador en vez de `select` cuando hay más de ~10 productos con receta.
- Que el resumen de consumo muestre también **cuánto queda** de cada insumo
  después de la tanda, no solo cuánto sale. Hoy dice "quedan 22" solo cuando
  alcanza; que lo diga siempre.

---

## P2 — Pulido

### 8. "Disponible para vender" se puede leer como "hay stock"

**Propuesto.** Son cosas distintas y el switch está arriba de todo. Un producto
puede estar disponible y tener cero.

**Hacer**
- Revisar el texto para que no se confunda con existencia. Candidatos: *"Se
  vende en esta sucursal"*, o dejarlo y agregar la sucursal al lado.

### 9. Ganancia y margen, con su unidad explícita

**Propuesto.** Ya dicen "por unidad" y "sobre el precio" en letra chica. La
revisión pide más jerarquía: el número primero, la etiqueta debajo. Es un cambio
menor y de bajo riesgo.

### 10. La foto, dentro del primer paso del alta

**Propuesto, y acá no coincido del todo.** La revisión propone fusionarla para
pasar de 5 pasos a 4. El riesgo: la foto es lo que hace que el producto se
reconozca en el mostrador, y meterla junto al nombre la convierte en un campo
opcional que se saltea siempre.

**Antes de tocarlo hay que medir**: qué porcentaje de productos se crea hoy con
foto. Si es alto, el paso está funcionando y fusionarlo lo rompe. Si es bajo, el
paso no sirve y hay que sacarlo. Es la única de la lista que **no** haría sin
datos.

---

## Lo que NO vamos a hacer

La revisión lo dice y coincido, pero queda escrito para que nadie lo "mejore"
más adelante sin saber por qué está así:

- Consolidar las cinco pantallas en el producto.
- Un insumo es un `Product` con `kind: INGREDIENT`, no una entidad aparte.
- Un insumo no muestra precio, margen ni rentabilidad.
- El costo del insumo se pide por bulto y lo divide el sistema.
- Promedio ponderado separado del costo de reposición.
- `—` cuando falta un dato. Nunca un cero inventado.
- Vista previa antes de mover stock y antes de producir.
- Motivo obligatorio en la pérdida.
- Los chips de la lista filtran.
- El producto se crea al final del asistente, nunca a mitad de camino.
- El lenguaje del negocio: "Se perdió o rompió", no "Merma".

---

## Orden de trabajo

1. Ticket 1 — la cantidad que se pierde. Es pérdida de datos.
2. Ticket 2 — los cambios que se descartan. Es pérdida de trabajo.
3. Ticket 3 — accesibilidad de las pestañas.
4. Ticket 4 — `+ Movimiento`.
5. Ticket 5 — el teléfono, con capturas propias antes de decidir.
6. El resto, por valor.
