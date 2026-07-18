---
name: webview-ready
description: >
  Reglas para asegurar que la app se porte correctamente en un entorno WebView (React Native, Flutter) o PWA.
  Trigger: Cuando implementes interacciones globales, alertas, navegación, o diseño base del layout.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Al agregar diálogos de confirmación, alertas o interacciones de hardware.
- Al definir el contenedor principal (`<main>`) o `layout.tsx`.
- Cuando se deba integrar una PWA o exportar la web a una App móvil nativa mediante WebView.

## Critical Patterns

### 1. No utilizar métodos bloqueantes del Browser
Un WebView no maneja bien los diálogos nativos del navegador web.
- **NUNCA uses**: `window.alert()`, `window.confirm()`, o `window.prompt()`.
- **Solución**: Usa `sonner`, `react-hot-toast`, o un diálogo de `shadcn/ui` para mensajes. Para confirmaciones, usa modales o BottomSheets renderizados en React.

### 2. Manejo de Safe Areas (Notches)
Los teléfonos modernos (iPhone, Android) tienen notches y barras de navegación nativas que se superponen a la pantalla.
- Utiliza las variables CSS de entorno de iOS/Android: `padding-bottom: env(safe-area-inset-bottom)`.
- Si usas Tailwind en componentes fijos (como una Bottom Nav), agrega padding dinámico. En Next.js `viewport` config, asegúrate de tener `viewport-fit=cover`.

### 3. Prevenir "Pull to Refresh" accidental
Si tu app requiere deslizar verticalmente mucho o tiene listas (ej. una grilla), el "pull-to-refresh" nativo de iOS Safari/Android Chrome puede recargar la app entera por accidente.
- En la etiqueta `<body>` o `<main>`, usa `overscroll-y-none` (o CSS `overscroll-behavior-y: none`) si implementas tu propio sistema de refresh o si la app es de "escritorio/dashboard".
- Ojo: Si quieres usar Pull-to-Refresh nativo, déjalo, pero no lo combines con scrolls internos extraños.

### 4. User Select & Callouts
Evita que el usuario seleccione texto por accidente al tocar dos veces un botón o tarjeta en la pantalla táctil.
- En textos que NO son seleccionables (labels, botones, tarjetas), usa `select-none`.
- En CSS/Tailwind evita el tap highlight azul nativo de iOS: `touch-callout-none` y `[-webkit-tap-highlight-color:transparent]`.

## Code Examples

### Layout Preparado para WebView
```tsx
<main className="min-h-screen w-full select-none overflow-x-clip bg-slate-50 [-webkit-tap-highlight-color:transparent]">
  {/* El contenido de la app */}
</main>
```
