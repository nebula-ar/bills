---
name: ui-tailwind-shadcn
description: >
  Reglas para mantener la coherencia visual con Tailwind y shadcn/ui.
  Trigger: Cuando diseñes componentes UI, agregues Tailwind classes o modifiques la paleta de colores.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Al agregar nuevas vistas, botones, inputs o tarjetas (cards).
- Al modificar el diseño base de la aplicación.
- Para evitar código espagueti con CSS en línea o colores hardcodeados.

## Critical Patterns

### 1. Colores Semánticos y Variables
NUNCA utilices colores duros (hexadecimales) ni estilos inline (`style={{color: 'red'}}`).
- Usa siempre la paleta de Tailwind. En este proyecto los botones principales usan `bg-blue-600` y fondos suaves usan `bg-slate-50`.
- Para errores: `text-rose-600`, `bg-rose-50`.
- Para éxitos: `text-emerald-700`, `bg-emerald-50`.

### 2. Bordes y Redondeos
Mantiene la consistencia de los bordes. El diseño moderno requiere bordes amplios.
- Contenedores principales y BottomSheets: `rounded-[2rem]` o `rounded-3xl`.
- Tarjetas y botones: `rounded-2xl` o `rounded-full`.
- Evita los bordes puntiagudos (`rounded-none` o `rounded-sm`) salvo que sea explícitamente necesario.

### 3. Sombras Suaves
Para generar profundidad en diseño Mobile, las sombras deben ser sutiles y tintadas.
- En botones principales: `shadow-sm shadow-blue-600/25`.
- En tarjetas elevadas (FABs): `shadow-lg shadow-blue-600/30`.
- Evita sombras genéricas fuertes como `shadow-2xl` si no están tintadas con el color principal.

### 4. Micro-animaciones e Interacciones
Todo elemento clickeable debe reaccionar al tacto.
- **Botones**: Agrega siempre `transition active:scale-95`. Esto da un feedback nativo cuando el usuario toca la pantalla.
- **Hover**: Usa `hover:bg-blue-700` o `hover:scale-105`. (Ojo: hover no existe en mobile puro, pero ayuda en tablet/desktop o si se usa mouse).

## Code Examples

### Card Elevada con Feedback Táctil
```tsx
<button
  type="button"
  className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
>
  <span className="font-bold text-slate-950">Continuar</span>
</button>
```
