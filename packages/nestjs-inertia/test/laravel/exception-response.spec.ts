// Ported from inertia-laravel v3.7.0 — tests/ExceptionResponseTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ExceptionResponseTest.php
//
// `Inertia::handleExceptionsUsing(fn (ExceptionResponse $response) => ...)` maps to an
// `InertiaExceptionFilter` subclass overriding `renderError()`, registered as `APP_FILTER`.
// `abort($status, $message)` maps to throwing an `HttpException`. Laravel's
// `ExceptionResponse::render()` sets the status implicitly; ours is set with `.status()`.
import { Catch, HttpException, Injectable, type Type } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import {
  InertiaExceptionFilter,
  InertiaMiddleware,
  type RenderErrorContext,
  type Responsable,
} from '../../src/index.js'
import { closeApps, createApp, inertiaHeaders, route, type RouteDefinition } from './helpers.js'

afterEach(closeApps)

/** `Inertia::handleExceptionsUsing($callback)`. */
function handleExceptionsUsing(callback: (context: RenderErrorContext) => Responsable | undefined): Type {
  @Catch()
  class Filter extends InertiaExceptionFilter {
    override renderError(context: RenderErrorContext) {
      return callback(context)
    }
  }

  return Filter
}

/** `Tests\Stubs\HttpExceptionMiddleware`. */
@Injectable()
class HttpExceptionMiddleware extends InertiaMiddleware {
  override share() {
    return { appName: 'My App' }
  }
}

const app = (routes: RouteDefinition[], filter: Type = InertiaExceptionFilter, middleware: Type<InertiaMiddleware> = InertiaMiddleware) =>
  createApp({ middleware, routes, providers: [{ provide: APP_FILTER, useClass: filter }] })

const abort = (status: number, message = 'Error') => {
  throw new HttpException(message, status)
}

describe('ExceptionResponseTest (inertia-laravel v3.7.0)', () => {
  // ports ExceptionResponseTest::test_exceptions_are_not_intercepted_without_handler
  it('exceptions are not intercepted without handler', async () => {
    const { http } = await app([route('GET', '/', () => abort(500))])

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(500)
    expect(response.headers).not.toHaveProperty('x-inertia')
  })

  // ports ExceptionResponseTest::test_exceptions_can_render_inertia_pages
  it('exceptions can render inertia pages', async () => {
    const filter = handleExceptionsUsing(({ inertia, status, error }) =>
      inertia.render('Error', { status, message: (error as Error).message }).status(status),
    )
    const { http } = await app([route('GET', '/', () => abort(500, 'Something went wrong'))], filter)

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(500)
    expect(response.body).toMatchObject({
      component: 'Error',
      props: { status: 500, message: 'Something went wrong' },
    })
  })

  // ports ExceptionResponseTest::test_exceptions_can_return_redirects
  it('exceptions can return redirects', async () => {
    const filter = handleExceptionsUsing(({ inertia, status }) =>
      status === 419 ? inertia.redirect('/login') : inertia.render('Error', { status }).status(status),
    )
    const { http } = await app([route('GET', '/', () => abort(419))], filter)

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/login')
  })

  // ports ExceptionResponseTest::test_exceptions_can_fall_through_to_default
  it('exceptions can fall through to default', async () => {
    const filter = handleExceptionsUsing(({ inertia, status }) =>
      status === 500 ? undefined : inertia.render('Error', { status }).status(status),
    )
    const { http } = await app([route('GET', '/', () => abort(500))], filter)

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(500)
    expect(response.headers).not.toHaveProperty('x-inertia')
  })

  // ports ExceptionResponseTest::test_exceptions_with_shared_data
  // (our error pages always include shared data; Laravel opts in with `->withSharedData()`)
  it('exceptions with shared data', async () => {
    const filter = handleExceptionsUsing(({ inertia, status }) => inertia.render('Error', { status }).status(status))
    const { http } = await app([], filter, HttpExceptionMiddleware)

    const response = await http().get('/non-existent-page').set(inertiaHeaders)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ component: 'Error', props: { status: 404, appName: 'My App' } })
  })

  // ports ExceptionResponseTest::test_exceptions_outside_middleware_are_handled
  it('exceptions outside middleware are handled', async () => {
    const filter = handleExceptionsUsing(({ inertia, status }) => inertia.render('Error', { status }).status(status))
    const { http } = await app([], filter)

    const response = await http().get('/non-existent-page').set(inertiaHeaders)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ component: 'Error', props: { status: 404 } })
  })
})
