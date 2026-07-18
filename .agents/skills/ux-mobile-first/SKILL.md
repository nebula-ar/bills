---
name: ux-mobile-first
description: >
  Reglas estrictas para el diseño de interacción móvil y ergonomía.
  Trigger: Cuando diseñes interfaces de usuario, agregues componentes visuales, o refactores vistas frontend.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Al crear o modificar pantallas (pages) o componentes de Next.js.
- Cuando el usuario pida mejorar el diseño de un formulario, lista o dashboard.
- Siempre que el proyecto priorice pantallas móviles (ej. WebViews, PWAs, React Native).

## Critical Patterns

### 1. Thumb Zones & FABs
Evita colocar acciones principales de creación o edición en la parte superior de la pantalla. El pulgar no llega cómodamente a la esquina superior derecha en dispositivos modernos.
- **Solución**: Usa Floating Action Buttons (FABs) en la esquina inferior derecha.
- **Clase Tailwind Mobile**: `fixed bottom-[96px] right-4` (para no pisar barras de navegación inferiores).
- **Desktop**: `md:bottom-8 md:right-8`.

### 2. Touch Targets Mínimos (44x44)
Apple HIG exige que las áreas táctiles sean de al menos 44x44 px. 
- En Tailwind, asegúrate de que botones e inputs tengan padding suficiente. Ejemplo: `py-3 px-4` o al menos `size-11` (44px) para botones iconográficos.

### 3. Evita "Modales" Clásicos
Los modales centrados (`Dialog` clásico) en mobile son difíciles de manejar y tapar teclado en iOS.
- **Solución**: Utiliza Bottom Sheets (`Drawer` de vaul o componente propio) que emergen desde abajo. Esto es nativo y ergonómico.

### 4. Empty States (Estados Vacíos) Semánticos
Un listado vacío no debe ser simplemente un texto plano.
- **Solución**: Usa un diseño "Premium": 
  1. Contenedor centrado con alto suficiente (`mt-8 p-10`).
  2. Icono semántico principal (`size-8 text-slate-300`) dentro de un círculo (`size-20 bg-white ring-1`).
  3. Título en negrita (`text-sm font-bold`).
  4. Instrucción secundaria gris claro (`text-xs text-slate-400`).

### 5. Scroll Horizontal con Affordance
Para filtros o tags ("Pills") horizontales, usa snap scrolling.
- **Contenedor**: `flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-1 pr-12`. El `pr-12` da espacio para que el último elemento quede cortado visualmente indicando que hay más.
- **Hijos**: `shrink-0 snap-start`.

## Code Examples

### Floating Action Button (FAB)
```tsx
<button
  type="button"
  className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
>
  <Plus className="size-6" />
</button>
```
