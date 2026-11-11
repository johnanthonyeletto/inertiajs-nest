# 0004. Inertia's one-time state lives behind a session interface

Status: Accepted (2026-11-11)

## Context

Flash data, validation errors (by error bag), `clearHistory`, and `preserveFragment` have to survive a redirect and be consumed once. The prototype wrote them straight to `request.session.inertia`, which tied the adapter to express-session and to the `SessionData` type augmentation.

## Decision

- An `InertiaSession` interface (`get`, `set`, `pull`) and an `InertiaSessionResolver` type (`(request) => InertiaSession | null`) are set with the `session` config option.
- The default, `expressSession()`, keeps the state under `request.session.inertia`. That works with express-session, cookie-session, and anything else with the same shape. `objectSession()` wraps any plain object.
- Without a session, writes are dropped with a one-time warning, rather than failing the request.
- Prefetch requests never consume one-time state.

## Consequences

- express-session is an optional peer dependency, and the package's types no longer augment it.
