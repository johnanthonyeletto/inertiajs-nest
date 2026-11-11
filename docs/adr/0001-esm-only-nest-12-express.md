# 0001. ESM only, NestJS 12, Node ≥ 22.12, Express first

Status: Accepted (2026-11-11)

## Context

NestJS 12 ships as ESM only. The best-maintained TypeScript Inertia adapter, `@adonisjs/inertia`, and the client's own `@inertiajs/vite` also ship ESM only. Supporting NestJS 10 and 11 would require a dual ESM/CommonJS build, a wider CI matrix, and testing against two module systems' decorator-metadata behaviour.

## Decision

- Publish ESM only, with an `exports` map and no CommonJS build.
- Support NestJS `^12.0.0` and Node.js `>=22.12`. Node 22.12 is the first LTS where `require(esm)` works without a flag, so CommonJS apps can still load the package.
- Support the Express platform only for now. Express-specific code (the `Request` augmentation, response guards) lives in `src/express.ts` and is also exposed as `inertia-nest/express`, so a Fastify entry point can be added alongside it later.

## Consequences

- Apps on NestJS 11 can't use the package. We'll revisit this if real users need it.
- CI tests Node 22 and 24, each against the latest Nest 12 release and the lowest supported minor (12.0).
