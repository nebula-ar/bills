# Proposal: Rediseñar acceso y alta pública

## Intent

Implementar los rediseños Pencil `WMXMk` (login) y `W97ZG` (registro) para que las dos puertas públicas compartan una tarjeta clara, táctil y consistente, sin alterar autenticación ni onboarding.

## Scope

### In Scope
- Adaptar `/login` al diseño `WMXMk`: fondo slate, tarjeta blanca, marca BB degradada, jerarquía, campos con iconos y CTA azul.
- Adaptar la bienvenida de `/register` al diseño `W97ZG`: ícono de comercio degradado, mensaje, lista de tres pasos y CTA.
- Preservar validaciones, accesibilidad, enlaces, estados de carga/error, navegación segura y safe areas.
- Añadir/actualizar pruebas E2E de presencia y flujos de ambas pantallas.

### Out of Scope
- Cambios a NextAuth, credenciales, acciones de registro o reglas de onboarding.
- Rediseñar los pasos posteriores del wizard, landing u otras rutas públicas.

## Capabilities

### New Capabilities
- `public-auth-entry-design`: presentación responsive y accesible de login y bienvenida de registro conforme a los nodos Pencil indicados.

### Modified Capabilities
- None; no existen especificaciones OpenSpec vigentes ni se modifica un requisito de dominio.

## Approach

Reutilizar los componentes y lógica actuales; cambiar únicamente la composición visual y las clases de `LoginPage`, `LoginForm` y la fase `welcome` de `RegisterWizard`. Usar tokens Tailwind existentes, objetivos táctiles de al menos 44 px y estados de foco/error visibles. Mantener los flujos en cliente ya existentes y evitar diálogos nativos.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `src/app/login/page.tsx` | Modified | Estructura y jerarquía visual del login. |
| `src/app/login/login-form.tsx` | Modified | Campos, iconos, CTA y estados del diseño. |
| `src/components/register-wizard.tsx` | Modified | Sólo la fase de bienvenida del registro. |
| `e2e/auth.spec.ts` | Modified | Cobertura de login y navegación. |
| `e2e/onboarding.spec.ts` | Modified | Cobertura de inicio del registro. |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| El rediseño rompa foco, lectura de errores o teclado móvil | Medium | Conservar inputs/atributos y validar E2E en viewport móvil. |
| Diferencias con el diseño en pantallas pequeñas | Medium | Usar layout fluido, safe areas y capturas Playwright. |

## Rollback Plan

Revertir los cambios de presentación de las tres piezas afectadas; los flujos y datos no cambian.

## Dependencies

- Fuente de diseño: `docs/design/bills-design-system.pen`, nodos `WMXMk` y `W97ZG`.

## Success Criteria

- [ ] Login y bienvenida de registro reflejan los nodos Pencil en desktop y móvil.
- [ ] Iniciar sesión, alternar contraseña, avanzar el alta y sus mensajes de error continúan funcionando.
- [ ] `npm test` y los E2E afectados pasan.
