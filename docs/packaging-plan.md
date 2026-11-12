# Packaging plan: a NestJS adapter for Inertia v3

Status: draft for review · Researched 2026-11-11 · Current client: `@inertiajs/*` 3.11.0, NestJS 12.4

## Implementation status (2026-11-11)

Phases 1–4 are implemented, except for the publishing steps. Phase 5 and the "Later" items haven't started.

| Phase | State |
|---|---|
| 1. Extract | Done. pnpm workspace with `packages/nestjs-inertia` (package `inertia-nest`), `apps/demo`, and `conformance/`. |
| 2. Library-grade API | Done. Middleware base class, opt-in filter and pipe, session and validator interfaces (class-validator and Zod), `forRootAsync`, root-view helpers, no deep imports and no adapter patch, `QUERY`, big integers, typed pages. |
| 3. Developer experience | Done. `./testing`, `./vite`, the `nestjs-inertia` CLI (`install`, `ssr:start\|stop\|check`), README, and ADRs in `docs/adr/`. Verified by packing the tarball and taking a fresh Nest 12 app from `install` to an SSR-rendered page, on Nest 12.4 and 12.0. |
| 4. Conformance and release | Conformance harness, Laravel test ports, and CI are done. **Not done (deferred):** changesets, changelog, npm publish with provenance. The package keeps `"private": true` and the working name `inertia-nest` until the name (Decision 3) is settled. |

How the decisions were resolved for now: 1, build our own (A); 4, Nest 12 only, ESM only, Express; 5, keep Precognition behind a validator interface. Decisions 2 and 3 are settled in [distribution-plan.md](distribution-plan.md): public, published as `@johnanthonyeletto/nestjs-inertia`, which also replaces the publishing part of Phase 4.

## Summary

The adapter in `src/inertia` already implements most of the Inertia v3 protocol and is independent of the demo app. To ship it as a package that other projects can depend on, three things need to happen:

1. **Reshape it to look like the other adapters.** Users should get a middleware class they extend, a root-template helper, SSR commands, and testing assertions, under the same concept names the Laravel reference uses.
2. **Make it safe to drop into an existing app.** No global pipe, filter, or validation behaviour forced on users; a pluggable session store and validator; no fragile reaches into Nest internals.
3. **Prove conformance.** Run the official `inertiajs/inertia` Playwright suite against the adapter in CI, alongside unit tests ported from inertia-laravel.

There is already one actively developed NestJS adapter, `@dudousxd/nestjs-inertia`, and it is listed on inertiajs.com. It has gaps in v3 protocol coverage and a large, opinionated surface. **Recommendation: publish our own lean, spec-complete adapter** with a clear position: *"complete Inertia v3 for NestJS, verified against the official client test suite, built on `@inertiajs/vite`."* The alternative, contributing our fixes to the incumbent, is laid out under [Decision 1](#decision-1-build-our-own-or-contribute).

## What the research found

### How official adapters are packaged

| | Laravel (reference) | Rails | Django | Phoenix |
|---|---|---|---|---|
| Package | `inertiajs/inertia-laravel` | `inertia_rails` | `inertia-django` | `inertia` (Hex) |
| Version ↔ protocol | Major = protocol (v3.x = Inertia v3) | Independent (3.x spans v1–v3) | Independent (2.x = v3) | 3.x = v3 |
| User wiring | Generated middleware subclass (`share()`, `version()`, `rootView`) + published config | Engine + initializer + controller `inertia_share` | `INSTALLED_APPS` + middleware + settings | Plug + config |
| Scaffolding | `inertia:middleware` stub | `rails g inertia:install` | none | `mix igniter.install inertia` |
| Root template | `@inertia` / `<x-inertia::app>` | `inertia_root` helper | template tag | `<.inertia_head>` |
| SSR tooling | `inertia:start-ssr`, `stop-ssr`, `check-ssr` | Puma plugin | POST to `/render` only | Supervised Node pool |
| Dev SSR via `@inertiajs/vite` | Yes (reads hot file) | Yes | No | No |
| Testing helpers | `assertInertia` (fluent) | RSpec + Minitest matchers | `InertiaTestCase` | `Inertia.Testing` |
| DevTools protocol | Yes (~2,700 lines) | Yes (3.23.0) | No | No |
| Precognition | Yes | Yes | No | No |

The pattern every adapter shares: **one package, a middleware or config file the user owns, a root-template helper, SSR wiring, and testing assertions.** None of them ties the package name to a convention; each uses its ecosystem's norms.

### What the Inertia ecosystem asks of community adapters

The source is the new [Building an Adapter](https://inertiajs.com/docs/v3/advanced/building-an-adapter) guide (`inertiajs/docs`, `v3/advanced/building-an-adapter.mdx`), plus the protocol page.

- **Follow your framework's conventions, but keep Laravel's names** (`render`, `share`, `defer`, `merge`, `version`).
- **Middleware duties:** `Vary: X-Inertia`; 409 on a version mismatch; 302 → 303 after PUT/PATCH/DELETE/**QUERY**; fragment redirects via `X-Inertia-Redirect`; redirect back on an empty 200; keep flash data across redirects and 409s; always share `errors` (`{}` when empty).
- **Implementation rules:** one code path for HTML and JSON; prop types as composable flags; partial-reload filters applied before prop callbacks run; error pages rendered through Inertia with shared data.
- **No official conformance suite exists**, but the client monorepo's Playwright suite can be run against a third-party backend. `@blacklizard/inertia-express` does this unmodified, pinned to v3.11.0, by substituting only the test server's `helpers` module (`conformance/run.sh` in that repo).
- **`@inertiajs/vite` has no hot file.** In dev it exposes `POST /__inertia_ssr` on the Vite server; the backend must find the dev server itself. We already handle this with our own hot-file plugin, the same approach the official Rust port documents.
- **Getting listed:** open a PR to `inertiajs/docs` adding a row (Language | Framework | Adapter | Inertia version) to `v3/installation/community-adapters.mdx`. The requirements:
  - it implements the protocol for a supported Inertia version;
  - it documents installation, the root template, and shared data;
  - it states its version and feature coverage;
  - it has an active maintainer and a published release.

  Recent listing PRs (#85, #99, #100) include a short feature-coverage summary.

### The existing NestJS adapters

| Package | Downloads/wk | Inertia | Nest | Format | Notes |
|---|---|---|---|---|---|
| `@dudousxd/nestjs-inertia` (+6 sibling packages) | ~900 | v3, partial | ≥10 | ESM + CJS | Listed on inertiajs.com. Very active, single maintainer. Express + Fastify, codegen, typed client, own Vite integration. Gaps: `flash` sent as a prop instead of the top-level `page.flash`; no fragment redirects or `preserveFragment`; no live props, big integers, or Precognition. |
| `inertia-nestjs` (ImSidow) | ~70 | v3, partial | 10–11 only | CJS | No once or scroll props. Excludes Nest 12. |
| `nestjs-inertia`, `@lapc506/nestjs-inertia`, `nest-inertia` | <20 | v1-era or placeholder | — | — | Dead or unusable. |

For comparison, the most polished TypeScript adapter, **`@adonisjs/inertia`** (~27k downloads/wk), is:
- ESM-only, with one `exports` subpath per concern (`./types`, `./plugins/api_client` for testing, `./helpers`, ...);
- built so framework and UI packages are (mostly optional) peer dependencies;
- configured through a user-extended `BaseInertiaMiddleware` and `defineConfig()`;
- typed through augmentable `InertiaPages` / `SharedProps` interfaces.

It documents its design choices in ADRs, including declining Precognition (ADR-0024).

### Where our adapter stands today

| Feature | Ours | `@dudousxd` |
|---|---|---|
| Core protocol, partial reloads, 409 versioning, 303 redirects | ✅ (303 still missing `QUERY`) | ✅ |
| Deferred (groups, rescue), optional, always, merge/prepend/deep merge/`matchOn` | ✅ | ✅ |
| Once props, infinite scroll, `sharedProps` | ✅ | ✅ |
| Top-level `flash`, fragment redirects, `preserveFragment` | ✅ | ❌ |
| Precognition | ✅ | ❌ |
| Live props (`liveProps`, `X-Socket-Id`) | ❌ | ❌ |
| `preserveBigIntegers` | ❌ | ❌ |
| SSR via `@inertiajs/vite` dev endpoint and production server | ✅ | Own Vite integration |
| Testing helpers | ❌ (internal tests only) | ✅ |
| Fastify | ❌ | ✅ |
| DevTools protocol | ❌ | ❌ |
| Scaffolding / install command | ❌ | ✅ (CLI) |

## Decisions needed

### Decision 1: build our own or contribute

| Option | Pros | Cons |
|---|---|---|
| **A. Publish our own (recommended)** | Full control. Protocol-complete today. Lean surface built on official tooling (`@inertiajs/vite`). Differentiated by verified conformance. | We'd be the second NestJS entry and must maintain it. Incumbent has more features (Fastify, codegen). |
| B. Contribute fixes upstream to `@dudousxd` | No new package to maintain. Joins existing users. | Single maintainer we don't control. Its Vite and template choices differ from ours. Our design (copy-on-write props, Precognition) would need to fit its architecture. |
| C. Use `@dudousxd` as-is internally | Zero work. | Protocol gaps (flash, fragments, Precognition) would surface as client bugs. |

If the package is for internal use only, option A gets cheaper: skip the public-ecosystem work in Phase 4.

### Decision 2: public or private

Public means npm with provenance, a docs listing, and support expectations. Private means a scoped package on a private registry, without the listing or support burden.

### Decision 3: package name

Taken on npm: `nestjs-inertia`, `inertia-nestjs`, `nest-inertia`.

Free: `inertia-nest`, `nestjs-inertiajs`, a scope we own (e.g. `@<scope>/nestjs-inertia`), and `@inertiajs/nestjs`. The `@inertiajs` scope requires the Inertia team's agreement, and the docs say the core team doesn't maintain community adapters, so don't count on it.

**Recommendation:** a scope we own.

### Decision 4: supported versions

**Recommendation:** Nest 12 only, ESM-only, Node ≥22.12, Express first.
- Nest 12 itself is ESM-only, and the polished adapters (Adonis, `@inertiajs/vite`) ship ESM only.
- Supporting Nest 10/11 would need dual ESM/CJS builds and a wider CI matrix. Revisit it if internal projects are still on Nest 11.

### Decision 5: validation and Precognition

Today the adapter assumes class-validator.

**Recommendation:**
- Keep Precognition, because it's a differentiator: only the Laravel and Rails adapters implement it.
- Put validation behind a small validator interface, shipping class-validator support first and Zod as a separate optional entry point.
- Record the decision in an ADR, as Adonis did for the opposite choice.

## Proposed package design

### Repository layout

Use a pnpm workspace in this repo:

```
packages/nestjs-inertia/        the adapter (published)
apps/demo/                      the current CRM + feature tour, depending on the package via workspace:*
conformance/                    runner for the upstream inertiajs/inertia Playwright suite
docs/adr/                       design decisions
```

### Entry points (`exports`)

| Subpath | Contents |
|---|---|
| `.` | `InertiaModule` (`forRoot`, `forRootAsync`), `InertiaMiddleware` base class, `InertiaContext`, `@Inertia()`, `@Precognitive()`, `@EncryptHistory()`, prop helpers, `defineConfig()`, responses |
| `./types` | `Page`, `PageProps`, augmentable `InertiaPages` / `SharedProps` |
| `./vite` | Vite plugin that writes the hot file (the piece `@inertiajs/vite` lacks), and helpers for the manifest and asset version |
| `./testing` | `assertInertia(response)` fluent assertions for supertest. Framework-neutral: it throws ordinary errors, so it works with Vitest and Jest. |
| `./validation/class-validator`, `./validation/zod` | Validator adapters (optional peer dependencies) |
| `./express` | Express-specific glue and the `Request` type augmentation. Keeps a later `./fastify` straightforward. |

**Peer dependencies:**
- required: `@nestjs/common`, `@nestjs/core` (`^12`), `rxjs`, `reflect-metadata`;
- optional: `@nestjs/platform-express`, `class-validator`, `class-transformer`, `zod`, `vite`, `express-session`.

Runtime dependencies stay at zero, or as close to it as possible.

### User-facing setup, modelled on Laravel and Adonis

```ts
// src/inertia/handle-inertia-requests.ts — generated by `npx nestjs-inertia install`, owned by the app
@Injectable()
export class HandleInertiaRequests extends InertiaMiddleware {
  rootView = rootView                                 // template function or a helper-based file
  share(request: Request) {
    return { auth: { user: request.user ?? null } }
  }
  version(request: Request) {
    return super.version(request)                     // Vite manifest hash by default
  }
}

// app.module.ts
@Module({ imports: [InertiaModule.forRoot(defineConfig({ ssr: { enabled: true } }))] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(session(...), HandleInertiaRequests).forRoutes('*')
  }
}
```

Specific changes from today's code:

1. **Global behaviour becomes opt-in.**
   - The exception filter only handles Inertia, HTML, and Precognition requests, and hands everything else to Nest's default handler.
   - The validation pipe becomes optional, plus a helper that converts an app's existing `ValidationPipe` errors.
   - The interceptor stays global, because Inertia responses depend on it.
2. **Session store interface** (`get`, `set`, `pull` for flash, errors, and history flags), with an express-session default.
3. **Remove the fragile internals.**
   - Replace the deep imports into `@nestjs/common` (route-argument metadata) with metadata we record in our own decorators.
   - Guard the `httpAdapter.reply` patch and cover it with tests on every supported Nest minor version, or replace it with an approach that needs no patching.
4. **Root template helpers.** Provide `inertiaHead(ctx)` and `inertiaBody(ctx)` (including SSR output), so any template engine or plain function can use them.
5. **SSR commands** shipped as a package `bin`: `nestjs-inertia ssr:start | ssr:stop | ssr:check`, built on the `/health` and `/shutdown` endpoints of `@inertiajs/core/server`.
6. **Install command** (`npx nestjs-inertia install`) that writes:
   - the middleware subclass;
   - the root view;
   - `resources/js/app.tsx` and `vite.config.ts` (with `@inertiajs/vite` and our hot-file plugin);
   - npm scripts.

   Prompts: framework (React/Vue/Svelte) and SSR on/off. This follows Rails' `inertia:install` and Adonis' former `configure` command.

### Catching up with the current protocol (v3.11)

| Item | Work |
|---|---|
| `QUERY` method | Add it to the 302 → 303 rule. |
| Live props | `Inertia.live(...)` with channels, events, and throttle; emit `liveProps`; honour `X-Socket-Id`. Depends on a broadcaster abstraction, so this is scoped as a later minor release. |
| `preserveBigIntegers` | Encode BigInt values per the protocol's big-integer section and set the flag. |
| Flash across redirects and 409s | Already equivalent (flash stays in the session until a page renders). Add a test that proves it. |
| Client bump | Move the demo to `@inertiajs/*` 3.11 and re-run every suite. |

## Verification strategy

1. **Unit and protocol tests:** keep the current 37, then port the relevant cases from inertia-laravel's `tests/` (the guide points to them as the edge-case reference).
2. **Official conformance suite:** run the unmodified `inertiajs/inertia` Playwright suite against the adapter, pinned to a release tag, following `@blacklizard/inertia-express`'s approach. This is the headline quality signal and the basis for a "v3" (not "v3 (partial)") listing.
3. **Demo app browser suite:** the existing 38 checks, run in CI against both the dev and production builds.
4. **CI matrix:** Node 22 and 24 × Nest 12 latest and lowest supported minor version (Express). Run the conformance job on every push to `main` and nightly.

## Phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Extract** | Workspace layout; move the adapter and its tests into `packages/`; demo depends on it via `workspace:*`; CI for unit, protocol, and browser suites. No behaviour changes. | Demo runs unchanged from the package; CI green. |
| **2. Library-grade API** | Middleware base class; opt-in filter and pipe; session store and validator interfaces; `forRootAsync`; root-template helpers; deep-import and patch cleanup; `QUERY`; big integers. | Demo migrated to the public API. No imports from the package's internal files. |
| **3. Developer experience** | `./testing` assertions; `./vite` plugin; SSR commands; install command; README with a feature-coverage table; ADRs for Precognition, ESM-only, and session handling. | A fresh Nest 12 app goes from `install` to an SSR-rendered page by following the README alone. |
| **4. Conformance and release** | Official Playwright suite in CI; Laravel test ports; changesets; Keep-a-Changelog; npm publish with provenance; `0.x` releases until the API settles, then `1.0.0`. | Conformance job green at the pinned v3.11 tag. First release published. |
| **5. Ecosystem** (public only) | PR to `inertiajs/docs` adding the NestJS row with a coverage summary, like #99 and #100. | Listed on inertiajs.com. |
| **Later** | Live props; Fastify (`./fastify`); DevTools protocol (Laravel's implementation is ~2,700 lines; no Node adapter has it yet); generated page-prop types (Adonis-style `pages.d.ts`). | Prioritise once there are real users. |

Phases 1–2 are worth doing even if the package stays internal.

## Risks

- **Protocol drift.** Inertia ships minor releases often (3.9 → 3.11 in about a month, adding live props). Mitigation: pin the conformance suite to a release, and adopt the documented practice of tracking inertia-laravel releases.
- **Nest internals.** The response pipeline depends on how Nest's router sends results. Mitigation: test against Nest minor versions in CI, and keep that code isolated.
- **Second-entrant positioning.** Users may default to the incumbent. Mitigation: a published conformance result and a coverage table. If the decision is option B, contribute instead.
- **Maintenance load** for a public package: issues, Inertia releases, Nest majors. Budget for it before going public.

## Sources

- Inertia docs (`inertiajs/docs` @ 8cfece1): `v3/advanced/building-an-adapter.mdx`, `v3/core-concepts/the-protocol.mdx` (live props, `QUERY` 303), `v3/installation/community-adapters.mdx` (docs PR #94; listing PRs #85, #99, #100), `v3/advanced/devtools-protocol.mdx`, `v3/advanced/testing.mdx`.
- `inertiajs/inertia` (client monorepo): `packages/vite/src/ssr.ts` (`/__inertia_ssr`), `packages/core/src/server.ts` (`createServer`, `/render`, `/health`, `/shutdown`), `tests/` (Playwright suite and Express fixture server).
- Adapters: `inertiajs/inertia-laravel` (Middleware, ResponseFactory, Ssr/HttpGateway, DevTools, Testing), `inertiajs/inertia-rails`, `inertiajs/inertia-django`, `inertiajs/inertia-phoenix`, `inertiajs/inertia-laravel-rust` (README, "Architecture and writing an adapter").
- Node adapters: `adonisjs/inertia` (ADRs 0006, 0008, 0010, 0011, 0012, 0014, 0024), `DavideCarvalho/nestjs-inertia`, `ImSidow/inertia-nestjs`, `blacklizard/inertia-express` (`conformance/run.sh`, `.github/workflows/conformance.yml`), `honojs/middleware` `packages/inertia`.
- npm registry metadata and the `api.npmjs.org` weekly download counts (week of 2026-11-04).
