# Inertia.js × NestJS

An [Inertia.js v3](https://inertiajs.com/docs/v3/core-concepts/the-protocol) server-side adapter for NestJS, a proof-of-concept app that uses every Inertia feature, and a harness that runs the official Inertia test suite against the adapter.

| Path | What it is |
| --- | --- |
| [`packages/nestjs-inertia`](packages/nestjs-inertia) | **The adapter** (`inertia-nest`). See [its README](packages/nestjs-inertia/README.md) for installation and usage. |
| [`apps/demo`](apps/demo) | A CRM on Sequelize (SQLite) plus a tour of 30+ feature demos in React, built on the adapter's public API |
| [`conformance`](conformance) | Runs the official `inertiajs/inertia` Playwright suite, unmodified, against the adapter |
| [`docs/adr`](docs/adr) | Architecture decision records |
| [`docs/packaging-plan.md`](docs/packaging-plan.md) | The research and plan behind the package |

Requires Node.js 22.12 or later. This is a pnpm workspace (pnpm 11, pinned in `packageManager`): run `pnpm install` once at the root.

## Quick start (demo)

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with `johndoe@example.com` / `secret` (pre-filled). The database is created and seeded the first time the app boots.

`pnpm dev` builds the adapter, then runs four processes:
- the adapter in watch mode;
- `tsc --watch` for the demo server;
- `node --watch dist/main.js`;
- the Vite dev server, which provides HMR and SSR through `/__inertia_ssr`.

While Vite runs, the `inertia-nest/vite` plugin writes `apps/demo/public/hot`, so the adapter loads assets and SSR from Vite instead of from the production build.

### Production

```bash
pnpm build                       # the adapter, then the demo's server, client bundle, and SSR bundle
pnpm --filter demo start:ssr     # nestjs-inertia ssr:start: the Inertia SSR server on 127.0.0.1:13714
pnpm start                       # the demo on :3000
```

If the SSR server isn't running, pages fall back to client-side rendering. The failure is logged but never fatal.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `APP_KEY` | dev placeholder | Session cookie signing secret. **Set it in production.** |
| `SESSION_SECURE_COOKIE` | `false` | Set to `true` behind HTTPS |
| `DB_STORAGE` | `database/database.sqlite` | SQLite file |
| `SSR_ENABLED` | `true` | Set to `false` to disable SSR |
| `INERTIA_SSR_URL` | `http://127.0.0.1:13714` | Production SSR server, used by the app and the `start:ssr`/`check:ssr`/`stop:ssr` scripts |
| `SSR_PORT` | `13714` | Port baked into the SSR bundle at `build:ssr` |

## Scripts (repository root)

| Script | Description |
| --- | --- |
| `pnpm test` | The adapter's Vitest suite: unit and HTTP-level protocol tests, tests ported from inertia-laravel, the testing helpers, the CLI, and the Vite plugin |
| `pnpm test:browser` | 38 Playwright checks of every demo page against a running demo (`BASE=http://localhost:3000`) |
| `pnpm test:conformance` | The official Inertia Playwright suite against the adapter (see [`conformance/README.md`](conformance/README.md)) |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm pack:check` | Build the adapter and list the files that would be published |
| `pnpm --filter demo db:fresh` | Recreate and reseed the demo database |

`pnpm test:browser` needs a Chromium for Playwright (`pnpm --filter demo exec playwright install chromium`). It creates data, so run `pnpm --filter demo db:fresh` first for a clean slate.

CI (`.github/workflows`) runs:
- the adapter suite on Node 22 and 24, against both the latest NestJS 12 and NestJS 12.0;
- the demo browser suite against the dev server and against the production build;
- the conformance suite on pushes to `master` (and on demand).

## The demo app

| Area | Pages |
| --- | --- |
| CRM | Dashboard (deferred groups); Organizations and Contacts: search as debounced partial reloads, pagination, soft deletes/restore, avatar uploads (multipart PUT with progress), notes via `<Form>`, optimistic favorites, once props |
| Navigation | Links (methods, `only`, preserve state/scroll, headers), manual visits and callbacks, cancellation, client-side visits, redirects (303, external 409), URL fragments (409 redirect, `preserveFragment`), scroll regions, history encryption, instant visits, view transitions |
| Forms | `useForm` (nested errors, transform, defaults, remember), `<Form>` + `useFormContext`, file uploads, validation error bags, Precognition (incl. a database uniqueness rule), optimistic updates with rollback, `useHttp` |
| Data loading | Partial reloads, deferred props (groups, rescue + retry), optional props, merging (append, prepend, `matchOn`, deep merge, reset), infinite scroll, once props (`fresh`, `until`, `as`), polling, `WhenVisible`, prefetching (hover/mount/click, stale-while-revalidate, cache tags) |
| State & layouts | `useRemember`, flash data (server and client), shared props, persistent/nested/named layouts with layout props, `<Head>` |
| Lifecycle | Global events, progress indicator, error pages vs. the error modal, `httpException`/`networkError` handling, asset versioning (simulated deploy) |

The Inertia wiring lives in `apps/demo/src/inertia/`:
- `handle-inertia-requests.ts`: the middleware subclass, with shared data, the per-session version salt, and the root view;
- `app-exception.filter.ts`: error pages, the 401 and 419 handling, and the error modal;
- `inertia.config.ts`.

Other supporting pieces:
- a Sequelize-backed `express-session` store (`src/common/session.ts`);
- double-submit CSRF protection compatible with the `XSRF-TOKEN` cookie the Inertia client reads (`src/common/csrf.ts`);
- session auth with scrypt password hashing (`src/auth`);
- a paginator implementing `toScrollMetadata()` (`src/database/paginator.ts`).

## Notes

- The adapter targets the Express platform. Live props and the DevTools protocol aren't implemented yet; see the adapter's [coverage table](packages/nestjs-inertia/README.md#protocol-coverage).
- The demo creates its tables with `sequelize.sync()` on boot, which suits a demo. Use migrations for real applications.
- The package is marked `"private": true` and is named `inertia-nest` for now. Publishing (final name, npm provenance, changelog) is a separate step.
- `pnpm audit` reports a moderate advisory in `uuid`, which Sequelize 6 depends on. It concerns an API Sequelize doesn't use, and there's no upstream fix yet.
