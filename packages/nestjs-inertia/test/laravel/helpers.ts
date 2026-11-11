/**
 * Shared harness for the tests ported from inertia-laravel v3.7.0
 * (https://github.com/inertiajs/inertia-laravel/tree/v3.7.0/tests).
 *
 * - `fakeRequest()` / `partialRequest()` + `resolveProps()` mirror the unit-level
 *   `PropsResolverTest::makePage()` / `makePartialRequest()` helpers.
 * - `visit()` mirrors `(new Response(...))->toResponse($request)`: a bare Express
 *   app that builds an `InertiaContext` (no Nest, no middleware) and sends the
 *   returned response. Its root view renders only the `@inertia` body, like the
 *   Laravel test stubs, so HTML output can be compared byte-for-byte.
 * - `createApp()` + `route()` mirror `Route::middleware([...])->get(...)`: a real
 *   Nest application whose routes are declared inline per test.
 */
import {
  Controller,
  type INestApplication,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
  Req,
  RequestMapping,
  RequestMethod,
  Res,
  type Type,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import express, { type Request, type Response } from 'express'
import request from 'supertest'
import {
  type InertiaConfig,
  type InertiaContext,
  InertiaManager,
  InertiaMiddleware,
  InertiaModule,
  type InertiaSessionData,
  objectSession,
  type Page,
  type PageProps,
  PropsResolver,
  type Responsable,
  type RootViewContext,
  SsrGateway,
  Vite,
} from '../../src/index.js'

export const hotFile = 'test/fixtures/hot'

/** Adapter defaults for every ported test: Vite "running hot" (so the default version is `''`) and no SSR. */
export const baseConfig: InertiaConfig = { vite: { hotFile }, ssr: { enabled: false } }

// ---------------------------------------------------------------------------
// Unit level: PropsResolver
// ---------------------------------------------------------------------------

export const COMPONENT = 'TestComponent'

/** `Request::create('/')` with the given headers. */
export function fakeRequest(headers: Record<string, string> = {}): Request {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))

  return { get: (name: string) => normalized[name.toLowerCase()] } as unknown as Request
}

/** `PropsResolverTest::makePartialRequest($only)`. */
export function partialRequest(only: string, headers: Record<string, string> = {}): Request {
  return fakeRequest({
    'X-Inertia': 'true',
    'X-Inertia-Partial-Component': COMPONENT,
    'X-Inertia-Partial-Data': only,
    ...headers,
  })
}

/** Resolve props like `PropsResolverTest::makePage()`, returning `{ props, ...metadata }`. */
export async function resolveProps(req: Request, props: PageProps, shared: PageProps = {}) {
  const [resolved, metadata] = await new PropsResolver(req, COMPONENT).resolve(shared, props)

  return { props: resolved as Record<string, any>, ...metadata }
}

/** `PropsResolverTest::makeScrollMetadata()`. */
export const scrollMetadata = () => ({ pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1 })

// ---------------------------------------------------------------------------
// Response level: an InertiaContext without Nest
// ---------------------------------------------------------------------------

export interface VisitOptions {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  headers?: Record<string, string>
  /** The asset version (`new Response(..., version: '123')`). */
  version?: string | null
  /** Props shared by the (absent) middleware. */
  share?: PageProps
  config?: InertiaConfig
  /** Mount the handler under a sub path (Express's equivalent of a sub-directory install). */
  mount?: string
}

export function createManager(config: InertiaConfig = {}): InertiaManager {
  const merged = { ...baseConfig, ...config }
  const vite = new Vite(merged)

  return new InertiaManager(merged, vite, new SsrGateway(merged, vite))
}

/** Root view of the Laravel test stubs: just the `@inertia` directive. */
export const bodyOnlyRootView = ({ body }: RootViewContext) => body

/** Build an `InertiaContext` for a real Express request and send what `build` returns. */
export function visit(
  url: string,
  build: (inertia: InertiaContext) => Responsable | Promise<Responsable>,
  options: VisitOptions = {},
) {
  const manager = createManager(options.config)
  const app = express()

  const handler = async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try {
      const inertia = manager.createContext(req, res, {
        share: () => options.share ?? {},
        version: () => options.version ?? '',
        rootView: bodyOnlyRootView,
      })

      await (await build(inertia)).toResponse(req, res)
    } catch (error) {
      next(error)
    }
  }

  if (options.mount) {
    app.use(options.mount, handler)
  } else {
    app.use(handler)
  }

  return request(app)[options.method ?? 'get'](url).set(options.headers ?? {})
}

/** The page object of a JSON (Inertia) or HTML (initial visit) response. */
export function pageOf(response: request.Response): Page<Record<string, any>> {
  if (/json/.test(response.headers['content-type'] ?? '')) {
    return response.body
  }

  const match = response.text.match(/<script data-page="[^"]*" type="application\/json">(.*?)<\/script>/s)

  if (!match) {
    throw new Error(`No page object found in: ${response.text}`)
  }

  return JSON.parse(match[1])
}

// ---------------------------------------------------------------------------
// HTTP level: a Nest application with inline routes
// ---------------------------------------------------------------------------

export interface RouteContext {
  inertia: InertiaContext
  req: Request
  res: Response
}

export interface RouteDefinition {
  method: keyof typeof RequestMethod
  path: string
  handler: (context: RouteContext) => unknown
  decorators: MethodDecorator[]
}

/** `Route::get('/path', fn () => ...)`. Extra method decorators (e.g. `@Precognitive()`) apply to the handler. */
export function route(
  method: RouteDefinition['method'],
  path: string,
  handler: RouteDefinition['handler'],
  decorators: MethodDecorator[] = [],
): RouteDefinition {
  return { method, path, handler, decorators }
}

function controllerFor(routes: RouteDefinition[]): Type {
  class RoutesController {}

  routes.forEach((definition, index) => {
    const key = `route${index}`
    let descriptor: PropertyDescriptor = {
      value(req: Request, res: Response) {
        return definition.handler({ inertia: req.inertia!, req, res })
      },
      writable: true,
      configurable: true,
    }

    Object.defineProperty(RoutesController.prototype, key, descriptor)
    Req()(RoutesController.prototype, key, 0)
    Res({ passthrough: true })(RoutesController.prototype, key, 1)

    // Decorators listed first are outermost, as when written above a method.
    const decorators = [
      RequestMapping({ path: definition.path, method: RequestMethod[definition.method] }),
      ...definition.decorators,
    ]

    for (const decorator of decorators.reverse()) {
      descriptor = (decorator(RoutesController.prototype, key, descriptor) as PropertyDescriptor | void) ?? descriptor
    }

    Object.defineProperty(RoutesController.prototype, key, descriptor)
  })

  Controller()(RoutesController)

  return RoutesController
}

/** `Tests\Stubs\ExampleMiddleware`: a fixed version and shared props, rendering only the `@inertia` body. */
export function exampleMiddleware(version: string | null = null, shared: PageProps = {}): Type<InertiaMiddleware> {
  @Injectable()
  class ExampleMiddleware extends InertiaMiddleware {
    override share() {
      return shared
    }

    override version() {
      return version
    }

    override rootView(context: RootViewContext) {
      return bodyOnlyRootView(context)
    }
  }

  return ExampleMiddleware
}

export interface AppOptions {
  routes: RouteDefinition[]
  /** Defaults to the base `InertiaMiddleware` (Laravel's `Inertia\Middleware`). `null` applies none. */
  middleware?: Type<InertiaMiddleware> | null
  config?: InertiaConfig
  /** Initial session state (`Session::put(...)`); `null` runs without a session (no `StartSession`). */
  session?: InertiaSessionData | null
  providers?: Provider[]
}

const apps: INestApplication[] = []

export interface TestApp {
  app: INestApplication
  http: () => ReturnType<typeof request>
  /** The session store shared by every request to this app (a single "browser"). */
  session: InertiaSessionData
}

export async function createApp(options: AppOptions): Promise<TestApp> {
  const session = options.session === null ? null : (options.session ?? {})
  const middleware = options.middleware === undefined ? InertiaMiddleware : options.middleware

  @Module({
    imports: [
      InertiaModule.forRoot({
        ...baseConfig,
        session: () => (session ? objectSession(session) : null),
        ...options.config,
      }),
    ],
    controllers: [controllerFor(options.routes)],
    providers: options.providers ?? [],
  })
  class TestModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      if (middleware) {
        consumer.apply(middleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
      }
    }
  }

  const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  await app.init()
  apps.push(app)

  return { app, http: () => request(app.getHttpServer()), session: session ?? {} }
}

/** Register with `afterEach(closeApps)`. */
export async function closeApps(): Promise<void> {
  await Promise.all(apps.splice(0).map((app) => app.close()))
}

export const inertiaHeaders = { 'X-Inertia': 'true' }
