# Tasks: Rediseñar acceso y alta pública

## Phase 1: Login presentation

- [x] 1.1 Update `src/app/login/page.tsx` with the `WMXMk` page shell, BB mark, desktop card, public links, and safe-area mobile spacing.
- [x] 1.2 Update `src/app/login/login-form.tsx` so labelled fields, password toggle, errors, focus, and primary CTA match the new hierarchy without changing submission logic.

## Phase 2: Registration welcome

- [x] 2.1 Update the `welcome` branch of `src/components/register-wizard.tsx` to match `W97ZG` while retaining `phase`, `step`, and server-action behavior.
- [x] 2.2 Keep the form and success branches unchanged except for shared container responsiveness required by the new welcome card.

## Phase 3: Test-first coverage

- [x] 3.1 Add failing E2E assertions in `e2e/auth.spec.ts` for login labels, public links, toggle, invalid credentials, and safe callback navigation.
- [x] 3.2 Add failing E2E assertions in `e2e/onboarding.spec.ts` for welcome copy, login link, and transition after "Empezar".
- [x] 3.3 Make the visual changes pass the new scenarios and preserve existing auth/onboarding flows.

## Phase 4: Verification

- [x] 4.1 Run `npx tsc --noEmit` and `npm test`.
- [x] 4.2 Run affected Playwright specs, then `npm run build` and the complete `npm run e2e` suite.
- [x] 4.3 Inspect the rendered public routes at mobile and desktop sizes; record results in the verification report.
