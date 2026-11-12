# @johnanthonyeletto/nestjs-inertia

An [Inertia.js](https://inertiajs.com) v3 server-side adapter for [NestJS](https://nestjs.com). Build single-page apps with React, Vue, or Svelte while keeping NestJS controllers, guards, pipes, and routing, without a separate API.

- **Complete v3 protocol.** Covers partial reloads, every prop type, flash data, fragment redirects, history encryption, Precognition, and big integers. See the [coverage table](#protocol-coverage).
- **Verified.** Tested against the official `inertiajs/inertia` Playwright suite (see `conformance/` in the repository) and against cases ported from inertia-laravel's test suite.
- **Built on the official tooling.** Uses `@inertiajs/vite` for page resolution and SSR, plus a small companion plugin.
- **Shaped like the official adapters.** You get a middleware class to extend, a root-template helper, SSR commands, and testing assertions, under the concept names inertia-laravel uses.

Requirements: NestJS 12, Node.js ≥ 22.12, and the Express platform. The package is ESM only.

## Contents

- [Installation](#installation)
- [Setup](#setup)
- [Pages and props](#pages-and-props)
- [Shared data](#shared-data)
- [Redirects, flash data, and history](#redirects-flash-data-and-history)
- [Validation and Precognition](#validation-and-precognition)
- [Error pages](#error-pages)
- [Asset versioning](#asset-versioning)
- [Server-side rendering](#server-side-rendering)
- [The root view](#the-root-view)
- [Big integers](#big-integers)
- [Typed pages](#typed-pages)
- [Testing](#testing)
- [Configuration reference](#configuration-reference)
- [Protocol coverage](#protocol-coverage)

## Installation

In an existing NestJS 12 app:

```bash
npm install @johnanthonyeletto/nestjs-inertia express-session
npx nestjs-inertia install
```

The install command asks for your client framework (React, Vue, or Svelte) and whether to enable SSR. It then writes:

| File | Purpose |
|---|---|
| `src/inertia/handle-inertia-requests.ts` | Your Inertia middleware: shared data, asset version, root view |
| `src/home.controller.ts` | An example controller rendering the `Home` page |
| `resources/js/app.tsx` (or `app.ts`) | The client entry |
| `resources/js/Pages/Home.*` | The first page component |
| `vite.config.ts` | `@inertiajs/vite`, your framework's plugin, and `@johnanthonyeletto/nestjs-inertia/vite` |
| `tsconfig.client.json` | TypeScript settings for the client code |

It also adds the npm scripts `dev:client`, `build:client`, `build:ssr`, and `ssr:start`, and adds `public/hot`, `public/build/`, and `bootstrap/ssr/` to `.gitignore`.

Existing files are never overwritten unless you pass `--force`. To run without prompts, pass `--framework react|vue|svelte` together with `--ssr` or `--no-ssr` (or `--yes` to accept the defaults).

When it finishes, the command prints the remaining steps. They are the same steps described under [Setup](#setup).

## Setup

**1. Install the client dependencies** (shown for React):

```bash
npm install -D vite @inertiajs/vite @inertiajs/react react react-dom @vitejs/plugin-react @types/react @types/react-dom @types/express-session
```

**2. Register the module, the middleware, and the exception filter** in your root module:

```ts
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import session from 'express-session'
import { InertiaExceptionFilter, InertiaModule } from '@johnanthonyeletto/nestjs-inertia'
import { HomeController } from './home.controller.js'
import { HandleInertiaRequests } from './inertia/handle-inertia-requests.js'

@Module({
  imports: [InertiaModule.forRoot({ vite: { entry: ['resources/js/app.tsx'] } })],
  controllers: [HomeController],
  providers: [{ provide: APP_FILTER, useClass: InertiaExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(session({ secret: process.env.APP_KEY!, resave: false, saveUninitialized: false }), HandleInertiaRequests)
      .forRoutes('*')
  }
}
```

The session middleware must run before `HandleInertiaRequests`. Flash data, validation errors, and history flags are kept in the session; see [`session`](#configuration-reference) for using a different store.

**3. Serve `public/`** from `main.ts`:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule)
app.useStaticAssets('public', { index: false })
```

**4. Keep the client code out of the server build.** Add `"resources"` and `"vite.config.ts"` to the `exclude` list in `tsconfig.build.json`.

**5. Run it.** Start `npm run dev:client` next to your usual Nest dev server. The Vite plugin writes `public/hot` while Vite runs, which tells the adapter to load assets (and SSR) from the dev server. For production, run `npm run build:client && npm run build:ssr`, then start the SSR server with `npm run ssr:start` alongside your app.

### What `InertiaModule` registers

`InertiaModule.forRoot(config)` (or `forRootAsync({ imports, inject, useFactory })`) registers the adapter's services and one global interceptor, which sends Inertia responses. The exception filter and the validation pipe are opt-in, so the adapter never changes how the rest of your app handles errors or validation:

| Provider | Register it when you want |
|---|---|
| `InertiaExceptionFilter` (`APP_FILTER`) | Validation errors to redirect back with errors, Precognition, and Inertia error pages. API (JSON) requests still get Nest's default handling. |
| `InertiaValidationPipe` (`APP_PIPE`) | DTO validation with Inertia-style errors. Set the `validator` option, see [Validation](#validation-and-precognition). |

If your app has interceptors that transform every handler result (for example, wrapping it in `{ data }`), let `Responsable` values through unchanged, for example `if (result instanceof Responsable) return result`. Otherwise an interceptor nested inside Inertia's (such as a controller-scoped one) would wrap the page before Inertia can send it.

## Pages and props

Inject the request's `InertiaContext` with `@Inertia()` and return `inertia.render()`:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { Inertia, type InertiaContext } from '@johnanthonyeletto/nestjs-inertia'

@Controller('users')
export class UsersController {
  @Get(':id')
  async show(@Inertia() inertia: InertiaContext, @Param('id') id: string) {
    return inertia.render('Users/Show', {
      user: await this.users.find(id),                         // always evaluated
      posts: () => this.posts.forUser(id),                     // lazy: skipped when a partial reload excludes it
      stats: Inertia.defer(() => this.stats.slow(id)),         // loaded by the client after the page renders
      teams: Inertia.optional(() => this.teams.forUser(id)),   // only loaded when a partial reload asks for it
      permissions: Inertia.always(() => this.acl.for(id)),     // included even in partial reloads that exclude it
    })
  }
}
```

The prop types mirror inertia-laravel's, including their fluent APIs:

| Factory | Behaviour |
|---|---|
| `Inertia.defer(fn, group?, { rescue? })` | Deferred, loaded in a follow-up request. Groups load together. `rescue` keeps the page working when the prop throws (it's reported as `rescuedProps`). |
| `Inertia.optional(fn)` | Never sent on a full visit; loaded on demand (`router.reload({ only })`, `<WhenVisible>`). |
| `Inertia.always(value)` | Always included, even when a partial reload filters it out. |
| `Inertia.merge(value)`, `Inertia.deepMerge(value)` | Merged into the client's existing value. Chain `.prepend()`, `.append('data')`, `.matchOn('id')`. |
| `Inertia.once(fn)` | Resolved once and remembered by the client across pages. Chain `.as(key)`, `.until(seconds \| Date)`, `.fresh()`. |
| `Inertia.scroll(paginator, { wrapper?, metadata? })` | A paginated prop for `<InfiniteScroll>`. The value must implement `toScrollMetadata()`, or you pass `metadata`. |

These compose: `Inertia.defer(fn).merge()`, `Inertia.optional(fn).once()`, `Inertia.merge(value).once()`. Partial reloads accept dot-notation paths such as `only: ['user.posts']`.

A rendered page can be extended with `.with(key, value)`, `.withViewData(data)` (passed to the root view only), `.status(code)`, and `.preserveBigIntegers()`.

## Shared data

Share data with every page from your middleware. `share()` is resolved when a page renders, so it sees state set by later middleware and guards, such as the authenticated user:

```ts
@Injectable()
export class HandleInertiaRequests extends InertiaMiddleware {
  share(request: Request) {
    return {
      appName: 'Acme',
      auth: { user: request.user ?? null },
      notifications: Inertia.once(() => this.notifications.unread(request.user)),
    }
  }
}
```

The adapter's services are property-injected, so your subclass can declare its own constructor dependencies. To share data from a single request (in a guard or controller), call `inertia.share('key', value)`. Dot-notation keys nest.

`errors` is always shared (`{}` when there are none). Shared prop keys are exposed as `sharedProps` so instant visits can carry them over; turn this off with `exposeSharedPropKeys: false`.

## Redirects, flash data, and history

```ts
return inertia.redirect('/users')            // 302, becomes 303 after PUT/PATCH/DELETE/QUERY
return inertia.back()                        // to the Referer
return inertia.location('https://stripe.com/checkout')  // full window.location visit (409 + X-Inertia-Location)
return inertia.flash('toast', { type: 'success', message: 'Saved' }).back()
return inertia.redirect('/docs#install')     // fragment redirects work (409 + X-Inertia-Redirect)
return inertia.preserveFragment().redirect('/users/1')
return inertia.clearHistory().redirect('/login')   // e.g. after logout
```

Every redirect follows the protocol rules, including Nest's `@Redirect()`, `res.redirect()`, and redirects from guards. If a handler returns nothing for an Inertia visit, the adapter redirects back.

Flash data appears in the page's `flash` field (`usePage().flash`, `router.on('flash')`), not in props, and isn't kept in history.

To encrypt history for a route or controller, use `@EncryptHistory()`. Use `inertia.encryptHistory()` for a single request, or `encryptHistory: true` in the config for every page.

## Validation and Precognition

Pick a validator and register the pipe:

```ts
import { APP_PIPE } from '@nestjs/core'
import { InertiaValidationPipe } from '@johnanthonyeletto/nestjs-inertia'
import { classValidator } from '@johnanthonyeletto/nestjs-inertia/validation/class-validator'   // or: zodValidator() from '@johnanthonyeletto/nestjs-inertia/validation/zod'

InertiaModule.forRoot({ validator: classValidator() })
providers: [{ provide: APP_PIPE, useClass: InertiaValidationPipe }]
```

When `@Body()` or `@Query()` validation fails:

- **Inertia visits and form posts** redirect back, with errors in the `errors` prop. The keys use dot notation, such as `address.city`. Error bags (`X-Inertia-Error-Bag`) are honoured.
- **JSON requests** (for example `useHttp`) get a `422` with `{ message, errors }`.

To fail validation manually (for example after a database check), `throw ValidationException.withMessages({ email: 'Already taken.' })`.

**Zod.** Attach a schema to a class so Nest can see it:

```ts
import { zodDto } from '@johnanthonyeletto/nestjs-inertia/validation/zod'

class CreateContactDto extends zodDto(z.object({ name: z.string().min(1) })) {}
```

**Keeping Nest's `ValidationPipe`.** Pass the factory: `new ValidationPipe({ exceptionFactory: inertiaExceptionFactory })`, from `@johnanthonyeletto/nestjs-inertia/validation/class-validator`.

**Precognition.** Add `@Precognitive()` to a route or a controller. A request with `Precognition: true` runs your guards and pipes, so the body is validated (only the `Precognition-Validate-Only` fields, when that header is sent). The handler never runs: the response is `204 Precognition-Success` when validation passes, or `422` with the errors.

```ts
@Post()
@Precognitive()
store(@Inertia() inertia: InertiaContext, @Body() body: CreateContactDto) { /* never runs for Precognition */ }
```

## Error pages

To render error pages, extend the filter and register your subclass instead:

```ts
@Catch()
export class AppExceptionFilter extends InertiaExceptionFilter {
  renderError({ status, error, inertia }: RenderErrorContext) {
    if (status === 419) return inertia.flash('toast', 'The page expired.').back()
    if ([403, 404, 500, 503].includes(status)) {
      return inertia.render('Error', { status }).status(status)
    }
  }
}
```

`renderError()` runs for Inertia visits and page loads. Returning `undefined` falls back to Nest's default handling. API requests always get Nest's default JSON errors.

## Asset versioning

By default the asset version is a hash of the Vite manifest. When the client's version is stale, a GET visit gets a `409` and the client reloads the page. As in inertia-laravel, the check runs after the handler, so a version set during the request with `inertia.setVersion()` counts. To customise the version:

```ts
version(request: Request) {
  return process.env.RELEASE_SHA ?? super.version(request)
}
```

## Server-side rendering

SSR is enabled by default and is used whenever a renderer is available:

- **In development**, the adapter renders through the `@inertiajs/vite` dev server, which it finds through `public/hot`. No separate process is needed.
- **In production**, run `vite build --ssr`, then start the SSR server:

  ```bash
  npx nestjs-inertia ssr:start    # runs bootstrap/ssr/app.js in the foreground (use a process manager)
  npx nestjs-inertia ssr:check    # exits 0 when the server is healthy
  npx nestjs-inertia ssr:stop
  ```

If the bundle is missing or rendering fails, the page falls back to client-side rendering and a warning is logged. To skip SSR, use `inertia.disableSsr()` for a single request or `ssr.except` for whole paths. `INERTIA_SSR_URL` and `INERTIA_SSR_BUNDLE` configure the CLI.

## The root view

Full page loads render an HTML document. The default is minimal. To customise it, override `rootView()`:

```ts
import { inertiaBody, inertiaHead, type RootViewContext } from '@johnanthonyeletto/nestjs-inertia'

rootView(context: RootViewContext) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    ${inertiaHead(context, { title: 'Acme' })}
  </head>
  <body>${inertiaBody(context)}</body>
</html>`
}
```

`inertiaHead()` returns the SSR head tags (or a fallback title) followed by the asset tags. `inertiaBody()` returns the mount point and the page data, or the server-rendered markup. Both are plain strings, so any template engine works: pass them to EJS, Handlebars, or similar. `context.viewData` holds the data passed with `.withViewData()`.

## Big integers

`bigint` values can't be sent as JSON. Enable big integer support with `preserveBigIntegers: true` in the config, or per response with `.preserveBigIntegers()`. Integers outside the safe range are then sent as `{"$bigint": "…"}` markers, which the client turns back into `BigInt`s, and safe ones are sent as plain numbers.

## Typed pages

Augment the types once, and `render()` checks the props you pass for each page:

```ts
// src/inertia/pages.d.ts
import '@johnanthonyeletto/nestjs-inertia/types'

declare module '@johnanthonyeletto/nestjs-inertia/types' {
  interface InertiaPages {
    'Users/Show': { user: User; stats: Stats }
  }
  interface SharedProps {
    auth: { user: User | null }
  }
}
```

`@johnanthonyeletto/nestjs-inertia/types` has no runtime code, so the client can import from it too, for example to type `usePage()`.

## Testing

`@johnanthonyeletto/nestjs-inertia/testing` provides fluent assertions modelled on Laravel's `assertInertia`. They work with supertest (or any response with headers and a body) and throw plain `AssertionError`s, so they run under Vitest, Jest, or `node:test`:

```ts
import { assertInertia, deferredPropsHeaders, inertiaHeaders, inertiaPage } from '@johnanthonyeletto/nestjs-inertia/testing'

const response = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders())

assertInertia(response, (page) =>
  page
    .component('Users/Show')
    .where('user.name', 'Ada')
    .has('user.roles', 2)
    .missing('user.password')
    .hasDeferred('stats'),
)

// Load the deferred props the way the client would:
const deferred = await request(app.getHttpServer()).get('/users/1').set(deferredPropsHeaders(inertiaPage(response)))
assertInertia(deferred).where('stats', { visits: 3 })
```

`inertiaPage()` reads the page from JSON responses and from full HTML page loads. When the page uses big integers, they come back as `bigint`s.

`inertiaHeaders()` sends an empty asset version by default. That matches an app with no built manifest, or with the Vite dev server running. If your tests run against a production build, pass the version: `inertiaHeaders({ version })`, or `{ page }` from an earlier response. A version mismatch (a `409`) is reported as one by `inertiaPage()`.

## Configuration reference

```ts
InertiaModule.forRoot(defineConfig({
  rootElementId: 'app',             // must match createInertiaApp({ id })
  encryptHistory: false,
  exposeSharedPropKeys: true,
  withAllErrors: false,             // send every message per field, not only the first
  preserveBigIntegers: false,
  session: expressSession(),        // or any (request) => InertiaSession | null
  validator: classValidator(),      // for InertiaValidationPipe
  vite: {
    entry: ['resources/js/app.tsx'],
    hotFile: 'public/hot',
    publicDirectory: 'public',
    buildDirectory: 'build',
    reactRefresh: true,              // set false for Vue and Svelte
    pagesDirectory: 'resources/js/Pages',   // used to preload the current page's chunk
    pageExtension: undefined,        // any extension; set e.g. '.vue' to restrict
  },
  ssr: {
    enabled: true,
    url: 'http://127.0.0.1:13714',
    bundle: 'bootstrap/ssr/app.js',
    timeout: 5000,
    except: ['/admin/*'],
  },
}))
```

`InertiaMiddleware` hooks: `share(request)`, `version(request)`, `rootView(context)`, and `onVersionChange(request, response, version)`.

**Entry points:**

| Import | Contents |
|---|---|
| `@johnanthonyeletto/nestjs-inertia` | Module, middleware, context, decorators, prop types, responses, filter, pipe, root-view helpers |
| `@johnanthonyeletto/nestjs-inertia/types` | `Page`, `PageProps`, `SharedProps`, `InertiaPages` (types only) |
| `@johnanthonyeletto/nestjs-inertia/vite` | The Vite plugin |
| `@johnanthonyeletto/nestjs-inertia/testing` | `assertInertia`, `inertiaPage`, `inertiaHeaders`, `deferredPropsHeaders` |
| `@johnanthonyeletto/nestjs-inertia/validation/class-validator` | `classValidator()`, `inertiaExceptionFactory` |
| `@johnanthonyeletto/nestjs-inertia/validation/zod` | `zodValidator()`, `zodDto()` |
| `@johnanthonyeletto/nestjs-inertia/express` | Express glue: `isInertiaRequest`, the `Request` augmentation |

## Protocol coverage

| Feature | Supported |
|---|---|
| Page object, HTML and JSON responses, `Vary: X-Inertia` | ✅ |
| Asset versioning (409 + `X-Inertia-Location`) | ✅ |
| 302 → 303 after PUT, PATCH, DELETE, QUERY | ✅ |
| External redirects (409 + `X-Inertia-Location`) | ✅ |
| Fragment redirects (409 + `X-Inertia-Redirect`), `preserveFragment` | ✅ |
| Redirect back on empty responses | ✅ |
| Partial reloads (`only`, `except`, dot-notation paths), `X-Inertia-Reset` | ✅ |
| Deferred props (groups, rescue), optional props, always props | ✅ |
| Merge, prepend, and deep-merge props, `matchOn` | ✅ |
| Once props (`as`, `until`, `fresh`), infinite scroll props | ✅ |
| `sharedProps`, error bags, top-level `flash` | ✅ |
| History encryption and clearing | ✅ |
| Precognition | ✅ |
| Big integers (`preserveBigIntegers`) | ✅ |
| SSR: `@inertiajs/vite` dev server and production server | ✅ |
| Live props (`liveProps`, `X-Socket-Id`) | Not yet |
| DevTools protocol | Not yet |
| Fastify | Not yet (Express only) |

## License

MIT
