# Design: Rediseñar acceso y alta pública

## Technical Approach

Implementar la especificación `public-auth-entry-design` mediante cambios de presentación localizados: página y formulario de login, y sólo la fase `welcome` de `RegisterWizard`. La autenticación y las server actions permanecen sin cambios.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
| --- | --- | --- | --- |
| Alcance del registro | Estilizar sólo `phase === "welcome"` | Rehacer todo el wizard | El nodo `W97ZG` describe la bienvenida; aislarlo conserva los pasos y sus validaciones. |
| Marca | Reutilizar iconos/componentes locales | Introducir assets o SVG nuevos | Mantiene el bundle y el sistema de iconos existentes. |
| Responsive | Tarjeta centrada desde `sm`, pantalla fluida antes | Anchos/altos fijos | Cumple el diseño desktop sin sacrificar safe areas ni teclado móvil. |
| Estados | Conservar DOM y atributos de formulario | Reemplazar la lógica del formulario | Protege callback seguro, `aria-*`, carga y errores ya implementados. |

## Data Flow

```
/login page ──props──> LoginForm ──signIn(credentials)──> NextAuth
                                      │
                                      └── router.push(safe callback) + refresh

/register ──> RegisterWizard(welcome) ──Empezar──> RegisterWizard(form)
                                                   └── existing server actions
```

## File Changes

| File | Action | Description |
| --- | --- | --- |
| `src/app/login/page.tsx` | Modify | Aplicar shell, marca, jerarquía y enlaces de `WMXMk`. |
| `src/app/login/login-form.tsx` | Modify | Ajustar campos, foco, toggle y CTA al mismo lenguaje visual. |
| `src/components/register-wizard.tsx` | Modify | Aplicar `W97ZG` a la bienvenida, preservando fases restantes. |
| `e2e/auth.spec.ts` | Modify | Afirmar elementos visibles y continuidad de login. |
| `e2e/onboarding.spec.ts` | Modify | Afirmar bienvenida y transición a primer paso. |

## Interfaces / Contracts

No se incorporan APIs, tipos, persistencia ni contratos nuevos. Se preservan `LoginFormProps`, `signIn`, `registerBusinessAction` y las rutas públicas existentes.

## Testing Strategy

| Layer | What to Test | Approach |
| --- | --- | --- |
| Unit | No nueva lógica pura | Mantener Vitest existente. |
| E2E | Semántica, enlaces, toggle, errores y transición de bienvenida | Extender specs Playwright existentes. |
| Build | Bundle de cliente sin Prisma | `npx tsc --noEmit` y `npm run build`. |

## Migration / Rollout

No migration required. El cambio se publica como sustitución visual reversible.

## Open Questions

None.
