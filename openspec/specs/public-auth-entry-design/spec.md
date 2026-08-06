# Public Auth Entry Design Specification

## Purpose

Define the responsive, accessible public entry experience for login and the welcome phase of business registration.

## Requirements

### Requirement: Login entry presentation

The system MUST present `/login` as the authenticated entry point with the visual hierarchy defined by Pencil node `WMXMk`: a light slate page, centered white card on larger screens, BB brand mark, heading, labelled credentials fields, and primary sign-in action. On small screens, the content MUST remain usable within safe areas without horizontal overflow.

#### Scenario: Visitor opens login

- GIVEN an unauthenticated visitor opens `/login`
- WHEN the page renders
- THEN the visitor sees the sign-in heading, email/username field, password field, primary "Ingresar" action, registration link, and terminal link
- AND all controls have visible labels.

#### Scenario: Mobile visitor uses login

- GIVEN the viewport is mobile-sized
- WHEN the login page renders
- THEN controls have touch targets of at least 44 px
- AND the password visibility control and submit action remain reachable without horizontal scrolling.

### Requirement: Login interaction continuity

The system MUST preserve existing credential submission, loading, error, password-visibility, and safe callback behavior while applying the new presentation.

#### Scenario: Invalid credentials

- GIVEN a visitor submits invalid credentials
- WHEN authentication rejects the request
- THEN an accessible error message is shown near the form
- AND the visitor can correct and resubmit the inputs.

#### Scenario: Valid credentials

- GIVEN a visitor submits valid credentials and a safe callback path
- WHEN authentication succeeds
- THEN the visitor is navigated to that callback path
- AND the current route data is refreshed.

### Requirement: Registration welcome presentation

The system MUST present the initial `/register` welcome phase according to Pencil node `W97ZG`: commerce mark, concise setup explanation, three preparatory items, primary "Empezar" action, and sign-in link. The welcome content MUST be responsive and preserve safe-area spacing.

#### Scenario: Visitor starts registration

- GIVEN an unauthenticated visitor opens `/register`
- WHEN the welcome phase renders
- THEN the visitor sees the three registration preparation items and an "Empezar" action
- AND selecting "Empezar" opens the existing onboarding form at its first step.

#### Scenario: Existing account holder changes path

- GIVEN a visitor is on registration welcome
- WHEN the visitor selects "Iniciar sesión"
- THEN the system navigates to `/login`
- AND no registration data is created.

### Requirement: Public entry accessibility and resilience

The system MUST retain semantic controls, focus indicators, visible error states, and working navigation links. It MUST NOT introduce browser-blocking dialogs or modify registration/authentication domain actions.

#### Scenario: Keyboard navigation

- GIVEN a keyboard user visits either entry screen
- WHEN they tab through interactive controls
- THEN focus is visible and follows a logical order
- AND each control can be activated by keyboard.
