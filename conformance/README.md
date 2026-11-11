# Inertia.js v3 conformance run

This directory runs the official `inertiajs/inertia` Playwright suite (about 1,370
browser tests written by the Inertia maintainers) against `inertia-nest` in a
real Chromium. The upstream suite is pinned to a release, the adapter is rebuilt
from this repo on every run, and the upstream checkout is never modified.

```bash
npm run test:conformance            # react (default)
conformance/run.sh react            # same thing
conformance/run.sh vue3             # or svelte
```

The approach is the one `@blacklizard/inertia-express` uses for its adapter.

## How it works

There is no standalone Inertia protocol test suite. The closest thing is the
Playwright suite inside `inertiajs/inertia`. It drives a framework test app
against an Express server, `tests/app/server.js`, which has about 230 routes. Each
route builds an almost-finished page object by hand, with `deferredProps`,
`mergeProps`, `deepMergeProps`, `matchPropsOn`, `onceProps`, `scrollProps`,
`rescuedProps` and `alwaysProps` written out inline. It then passes the object to
`tests/app/helpers.js`. That module is the server's protocol engine:

- it reads the partial-reload headers, filters the props and evaluates the
  function props
- it decides between a JSON and an HTML response, and serializes the page
- it encodes big integers
- it writes the 409 location and redirect responses

`helpers.js` is therefore the seam between the routes and the protocol engine.
The run swaps it without changing a file in the checkout:

1. **`preload.cjs`** is loaded into every Node process of the run with
   `NODE_OPTIONS=--require`. It hooks `Module._resolveFilename`. When
   `server.js` resolves `require('./helpers')` to the upstream `helpers.js`, the
   hook returns `conformance/helpers.cjs` instead. Every other module resolves
   normally.
2. **`helpers.cjs`** is a port of upstream's `helpers.js`. It loads the adapter
   with `require('inertia-nest')`, which works through Node's require(esm)
   support (Node 22.12 or later) and the workspace symlink in `node_modules`.
   Page assembly is the same as upstream's: the component name, URL, version,
   the metadata the route computed, the `alwaysProps` merge and every HTML
   template branch. The protocol engine runs through the adapter:

   | Step | Upstream `helpers.js` | `helpers.cjs` |
   | --- | --- | --- |
   | Partial-reload filtering and prop evaluation | inline `processPartialProps` | `new PropsResolver(req, component).resolve({}, props)`. The route's props are passed as-is, closures included. Route metadata is kept; the resolver can only add keys the route didn't set. |
   | Inertia request check | `req.get('X-Inertia')` | `isInertiaRequest(req)` |
   | JSON response body | `res.json(page)` | `serializePage(page)` |
   | `<script type="application/json">` body (`renderUnified`, `renderAuto`) | `JSON.stringify` with `/` and `<` escaped | `encodePageForScript(page)` (also escapes `>`, U+2028 and U+2029, so it is JSON-equivalent) |
   | `window.initialPage = …` body (`render`, `renderWithPlainTitle`) | `JSON.stringify(page)` | `serializePage(page)` (the same bytes, apart from big integers) |
   | Big integers | every `bigint` is turned into a `{"$bigint"}` marker before props are resolved | `serializePage` encodes them with the adapter's `encodeBigInt` replacer at serialization time. Safe-range bigints become plain numbers, which is the adapter's rule. The `preserveBigIntegers` stand-in that marks pages containing bigints or markers is kept. |
   | `location(res, href, version)` | always 409 + `X-Inertia-Location` | `LocationResponse`: 409 for Inertia requests, 302 otherwise. A version is echoed in `X-Inertia-Version`. |
   | `redirect(res, href)` | always 409 + `X-Inertia-Redirect` | the redirect rules `InertiaMiddleware` installs on every response: 409 + `X-Inertia-Redirect` for URLs with a fragment, except on prefetches |
   | Module load | (nothing) | writes `[conformance] helpers swapped -> …` to stderr |

   Run `diff conformance/inertia/tests/app/helpers.js conformance/helpers.cjs`
   to see every change.
3. **`run.sh [react|vue3|svelte] [playwright args…]`** does the following:
   1. Builds `inertia-nest`, so a stale `dist/` can't be tested by mistake.
   2. Shallow-fetches `inertiajs/inertia` at the pinned tag into
      `conformance/inertia/` (ignored by git) and checks the commit sha.
   3. Installs and builds the upstream monorepo and the framework test app with
      pnpm. Upstream needs pnpm 11.1.1 or later. If yours is older, the script
      puts an npx-backed `pnpm@11` shim on `PATH`.
   4. Refuses to run if the checkout has any tracked or untracked change other
      than to `pnpm-lock.yaml`.
   5. Refuses to run if the test port is already taken. Outside CI, Playwright
      would otherwise reuse whatever server is listening there, bypassing the
      swap.
   6. Prints the [known deviations](#known-deviations) it excludes, with their
      count. It aborts unless the exclusion pattern matches exactly as many
      tests as the list has entries.
   7. Runs upstream's `playwright.js` with `--retries=2` and the exclusions as a
      `--grep-invert` pattern.
   8. Fails if the swap marker is missing from the output, and checks the
      checkout again afterwards.

The ports are upstream's: 13716 for react, 13715 for vue3 and 13717 for svelte.
The SSR spec, which needs port 13714, is excluded from this non-SSR run, as it
is upstream.

**Proof of the swap.** Upstream's own `helpers.js` passes the suite too, so a
green run on its own proves nothing. Playwright pipes the web server's stderr
into the run output, and every valid run contains this line:

```
[WebServer] [conformance] helpers swapped -> …/conformance/helpers.cjs (inertia-nest: …/packages/nestjs-inertia/dist/index.js)
```

## What is and isn't covered

Be careful how you read a passing count. The upstream routes compute almost all
page metadata themselves, so this run **mainly checks the adapter's request
parsing, partial-reload filtering, prop evaluation and transport against the
real 3.11 client.** It doesn't show that the adapter implements every 3.11
feature.

Exercised by the run:

- `PropsResolver` reading `X-Inertia-Partial-Component`, `-Partial-Data`,
  `-Partial-Except`, `X-Inertia-Reset`, `X-Inertia-Except-Once-Props` and the
  merge-intent header from a real Express request
- partial-reload filtering, including dotted paths and nested-path matching
- closure and promise evaluation, and `toJSON` handling
- JSON and HTML serialization (`serializePage`, `encodePageForScript`) and
  big-integer markers (`encodeBigInt`)
- the 409 `X-Inertia-Location` and `X-Inertia-Redirect` responses (on the few
  routes that use the helpers)

Not exercised by the run (the adapter's own unit and e2e tests cover these):

- **Prop types** (`defer`, `optional`, `always`, `merge`, `deepMerge`, `once`,
  `scroll`, `rescue`) and the metadata they produce. The routes write
  `deferredProps`, `mergeProps` and the rest by hand and never build `Prop`
  instances, so the resolver's metadata collection stays idle.
- **The NestJS layer**: `InertiaModule`, `InertiaInterceptor`, `@Inertia()`,
  `InertiaMiddleware` (shared props, version checks, 303 promotion and empty
  responses on routes that don't go through the helpers), the exception
  filter, validation and Precognition, sessions, flash and history flags. The
  Precognition specs run against upstream's own inline route logic.
- **The adapter's root view and initial-page format.** The test apps use their
  own `index.html` templates.
- **SSR.** `ssr.spec.ts` only runs in upstream's SSR mode, which this script
  doesn't start, and it would hit the adapter's transport only, not
  `SsrGateway`.

## Known deviations

`run.sh` excludes 18 upstream tests by default. The list is `KNOWN_DEVIATIONS`
in `run.sh`. Each entry is an exact title path (spec file, describe block and
test title), escaped and anchored into one `--grep-invert` pattern. The script
prints the excluded titles and their count at the start of every run. It aborts
if the pattern matches any number of tests other than the number of entries,
so the list can't quietly exclude another test or go stale when upstream
changes. Set `CONFORMANCE_NO_EXCLUSIONS=1` to run them.

Every excluded test **passes against upstream's own `helpers.js`**
(`CONFORMANCE_BASELINE=1`). These are not flakes, and not bugs in the client
or the suite. They test behaviour of the reference server that `inertia-nest`
deliberately does not copy, because the adapter follows inertia-laravel. In
both cases the protocol doesn't require the reference server's behaviour.

### 1. Closures are called without arguments (17 tests)

- `links.spec.ts › partial reloads ›` 5 tests (lines 951, 965, 982, 991 and
  1014)
- `manual-visits.spec.ts › Partial Reloads ›` 6 tests (lines 1141, 1158, 1175,
  1192, 1201 and 1225), each in a `visit` and a `GET` variant

The `/links/partial-reloads` and `/visits/partial-reloads` routes define
`bar: (props) => props.foo + 1`. The reference server calls function props as
`fn(data.props)`. `PropsResolver` calls them with no arguments, as
inertia-laravel does: see `resolveCallable` in
`packages/nestjs-inertia/src/props.ts:30`, reached from
`PropsResolver.resolveValue` in `src/props-resolver.ts:241-242`. On these routes
the closure throws `TypeError: Cannot read properties of undefined (reading
'foo')`, and the page returns 500.

Passing the props bag is a convention of the reference server's routes, not
part of the protocol. Copying it would also silently break method references
with optional parameters, such as `count: repo.count`, which would receive the
props bag as their first argument. The harness never rewrites a route's props,
so the resolver sees exactly what a route handler would give it.

### 2. Nested `except` drops only the child path (1 test)

- `nested-props.spec.ts › it preserves rescued child props when that child path
  is excluded from reload` (line 32)

The client reloads with `except: ['auth.notifications']`. The reference server
filters top-level keys only, and drops a key whenever an except entry equals it
or lives under it. Here that means the whole `auth` prop is dropped, so the
client keeps its old `auth.token`. `inertia-nest` follows Laravel semantics: it
keeps `auth` and drops only the `auth.notifications` child (see
`pathMatchesPartialRequest` and `matchesExcept` in `src/props-resolver.ts:171`
and `:332`). The route's new `auth.token` reaches the client, and the test fails
with `Expected "Token: secret-token-123", Received "Token: rotated-token-456"`.

### Related, not excluded: nested `only`

For `only: ['account.balance']` (on `/live`), `PropsResolver` returns only the
`account.balance` child, which is also Laravel semantics. The reference server
returns the whole top-level `account` prop. The 3.11 client merges both
correctly, so no test fails and nothing is excluded.

## Switches

- `CONFORMANCE_BASELINE=1 conformance/run.sh react tests/foo.spec.ts` runs
  without the preload, against upstream's unmodified `helpers.js`. Known
  deviations aren't excluded in this mode. A test that also fails here is an
  environment flake or an upstream issue, not the adapter.
- `CONFORMANCE_NO_EXCLUSIONS=1 conformance/run.sh` runs the known deviations
  too. Expect exactly those 18 tests to fail.
- `INERTIA_REF=master conformance/run.sh` tests against another upstream ref.
  The sha check is skipped and the ref is always re-fetched. If upstream has
  changed the excluded tests, the exclusion check aborts the run.
- Any extra arguments go to Playwright. For example,
  `conformance/run.sh react tests/links.spec.ts` runs one spec file.

The first run takes about 5–10 minutes: it fetches upstream, builds the
monorepo, downloads Chromium and runs the suite. Later runs take about 4
minutes. Delete `conformance/inertia/` to force a fresh fetch.

pnpm: upstream requires pnpm 11.1.1 or later (`engines.pnpm` in its
`package.json`). If `pnpm` on `PATH` is older than 11, `run.sh` puts a
`pnpm@11.5.3` shim (through npx) first on `PATH`. CI should provide pnpm 11.

## Last result

Run on 2026-11-11 against upstream `inertiajs/inertia` release `v3.11.0` (commit
`f312557`), with chromium and Node 22.13.0. The adapter was rebuilt from this
repo, the checkout was pristine before and after the run, and the swap marker
was in the output. Both runs exited 0.

| Framework | Passed | Failed | Flaky | Skipped¹ | Excluded² | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| react | 1326 | 0 | 0 | 25 | 18 | 1369 |
| vue3 | 1332 | 0 | 0 | 19 | 18 | 1369 |

¹ The suite's own framework-conditional skips.
² The [known deviations](#known-deviations). An earlier react run the same
day, with nothing excluded and on the adapter build before its latest
`Vary`/version-check change, failed exactly these 18 tests and no others: 1326
passed, 18 failed, 25 skipped. All 18 pass with
`CONFORMANCE_BASELINE=1`: 227 passed and 3 skipped across their three spec
files.

Read [What is and isn't covered](#what-is-and-isnt-covered) before reading
anything into "0 failed". The routes compute almost all page metadata
themselves, so this result shows the adapter's request parsing, partial-reload
filtering, prop evaluation and transport are wire-compatible with client 3.11.0.
It doesn't show that the adapter implements every 3.11.0 feature.
