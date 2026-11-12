# 0002. Keep Precognition; validate through a pluggable validator

Status: Accepted (2026-11-11)

## Context

Precognition (live server-side validation of forms) is part of the Inertia v3 client. Among server adapters, only Laravel and Rails implement it. AdonisJS declined it (their ADR-0024) because it couples the adapter to validation. The prototype assumed class-validator everywhere and decided which routes Precognition applied to by deep-importing Nest's route-argument metadata (`@nestjs/common/constants.js`).

## Decision

- Keep Precognition. It's a differentiator, and the protocol is small.
- Mark a route or controller with `@Precognitive()`. The decorator wraps the handler, so that for a Precognition request the handler throws `PrecognitionSuccessException` instead of running. Guards and pipes still run first. Validation therefore works with any pipe (ours, Nest's `ValidationPipe`, or a custom one), and the deep import is gone.
- Validation goes through a small `InertiaValidator` interface (`supports(metatype)`, `validate(value, metatype, metadata)`), used by `InertiaValidationPipe`. Two integrations ship as separate entry points whose dependencies are optional peers:
  - `@johnanthonyeletto/nestjs-inertia/validation/class-validator`, which provides `classValidator()` and an `inertiaExceptionFactory` for Nest's `ValidationPipe`;
  - `@johnanthonyeletto/nestjs-inertia/validation/zod`, which provides `zodValidator()` and `zodDto()` for Zod 3.25+ and 4.
- `Precognition-Validate-Only` filtering is shared: `precognitiveErrors()` and `validationExceptionFor()`.

## Consequences

- The core package imports neither class-validator nor Zod.
- Precognition relies on the request context (AsyncLocalStorage) that `InertiaMiddleware` sets up. A Precognition request to a `@Precognitive()` route without the middleware fails loudly instead of running the handler.
