// Ported from inertia-laravel v3.7.0 — tests/MiddlewareTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/MiddlewareTest.php
//
// `Inertia\Middleware` maps to our `InertiaMiddleware`; `Tests\Stubs\ExampleMiddleware`
// to `exampleMiddleware(version, shared)`. Routes registered without `StartSession`
// run without a session (`session: null`). `Session::put('errors', ViewErrorBag)` maps
// to seeding our session's `errors` (bag → field → messages).
import { createHash } from 'node:crypto'
import { createReadStream, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Header, Injectable, StreamableFile } from '@nestjs/common'
import {
  Inertia,
  InertiaMiddleware,
  Precognitive,
  type InertiaSessionData,
  type RootViewContext,
} from '../../src/index.js'
import { closeApps, createApp, exampleMiddleware, inertiaHeaders, pageOf, route } from './helpers.js'

afterEach(closeApps)

/** `prepareMockEndpoint()`: a session-backed `/` rendering `User/Edit` through the given middleware. */
function mockEndpoint(options: { version?: string | null; shared?: Record<string, unknown>; session?: InertiaSessionData } = {}) {
  return createApp({
    middleware: exampleMiddleware(options.version ?? null, options.shared ?? {}),
    session: options.session ?? {},
    routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit', { user: { name: 'Jonathan' } }))],
  })
}

const varyTokens = (vary: string | undefined) =>
  (vary ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .sort()

const errorBag = {
  default: {
    name: ['The name field is required.'],
    email: ['Not a valid email address.', 'Another email error.'],
  },
}

describe('MiddlewareTest (inertia-laravel v3.7.0)', () => {
  // ports MiddlewareTest::test_no_response_value_by_default_means_automatically_redirecting_back_for_inertia_requests
  it('no response value by default means automatically redirecting back for inertia requests', async () => {
    let fooCalled = false
    const { http } = await createApp({
      session: null,
      routes: [
        route('PUT', '/', () => {
          fooCalled = true
        }),
      ],
    })

    const response = await http()
      .put('/')
      .set({ ...inertiaHeaders, 'Content-Type': 'application/json', Referer: '/foo' })

    expect(response.status).toBe(303)
    expect(response.headers.location).toBe('/foo')
    expect(fooCalled).toBe(true)
  })

  // ports MiddlewareTest::test_redirects_from_query_requests_are_converted_to_303
  it('redirects from query requests are converted to 303', async () => {
    const { app } = await createApp({
      session: null,
      routes: [route('ALL', '/', ({ inertia }) => inertia.redirect('/foo'))],
    })

    const server = app.getHttpServer().listen(0)
    const { port } = server.address() as AddressInfo

    const { status, location } = await new Promise<{ status?: number; location?: string }>((resolve, reject) => {
      const req = httpRequest(
        { port, method: 'QUERY', path: '/', headers: { ...inertiaHeaders, 'Content-Type': 'application/json' } },
        (res) => {
          res.resume()
          resolve({ status: res.statusCode, location: res.headers.location })
        },
      )
      req.on('error', reject)
      req.end(JSON.stringify({ search: 'foo' }))
    })

    server.close()
    expect(status).toBe(303)
    expect(location).toBe('/foo')
  })

  // ports MiddlewareTest::test_no_response_means_no_response_for_non_inertia_requests
  it('no response means no response for non inertia requests', async () => {
    let fooCalled = false
    const { http } = await createApp({
      session: null,
      routes: [
        route('PUT', '/', () => {
          fooCalled = true
        }),
      ],
    })

    const response = await http().put('/').set({ 'Content-Type': 'application/json', Referer: '/foo' })

    expect(response.status).toBe(200)
    expect(response.text).toBe('')
    expect(fooCalled).toBe(true)
  })

  // ports MiddlewareTest::test_the_version_is_optional
  it('the version is optional', async () => {
    const { http } = await mockEndpoint()

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ component: 'User/Edit' })
  })

  // ports MiddlewareTest::test_the_version_can_be_a_number
  it('the version can be a number', async () => {
    const version = 1597347897973
    const { http } = await mockEndpoint({ version: version as unknown as string })

    const response = await http().get('/').set({ ...inertiaHeaders, 'X-Inertia-Version': String(version) })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ component: 'User/Edit' })
  })

  // ports MiddlewareTest::test_the_version_can_be_a_string
  it('the version can be a string', async () => {
    const { http } = await mockEndpoint({ version: 'foo-version' })

    const response = await http().get('/').set({ ...inertiaHeaders, 'X-Inertia-Version': 'foo-version' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ component: 'User/Edit' })
  })

  // ports MiddlewareTest::test_a_response_body_of_zero_is_not_treated_as_empty_for_inertia_requests
  it('a response body of zero is not treated as empty for inertia requests', async () => {
    const { http } = await createApp({ session: null, routes: [route('GET', '/', () => '0')] })

    const response = await http().get('/').set({ ...inertiaHeaders, Referer: '/foo' })

    expect(response.status).toBe(200)
    expect(response.text).toBe('0')
  })

  // ports MiddlewareTest::test_streamed_responses_are_not_treated_as_empty_for_inertia_requests
  // `response()->streamDownload()` maps to returning a stream-backed `StreamableFile`.
  it('streamed responses are not treated as empty for inertia requests', async () => {
    const { http } = await createApp({
      session: null,
      routes: [
        route(
          'GET',
          '/',
          () => new StreamableFile(Readable.from(['hello']), { disposition: 'attachment; filename="hello.txt"' }),
        ),
      ],
    })

    const response = await http().get('/').set({ ...inertiaHeaders, Referer: '/foo' })

    expect(response.status).toBe(200)
    expect(response.headers['content-disposition']).toBe('attachment; filename="hello.txt"')
  })

  // ports MiddlewareTest::test_file_downloads_are_not_treated_as_empty_for_inertia_requests
  // `response()->download()` maps to returning a file-backed `StreamableFile`.
  it('file downloads are not treated as empty for inertia requests', async () => {
    const { http } = await createApp({
      session: null,
      routes: [
        route(
          'GET',
          '/',
          () =>
            new StreamableFile(createReadStream('test/fixtures/hot'), {
              disposition: 'attachment; filename="example.vue"',
            }),
        ),
      ],
    })

    const response = await http().get('/').set({ ...inertiaHeaders, Referer: '/foo' })

    expect(response.status).toBe(200)
    expect(response.headers['content-disposition']).toBe('attachment; filename="example.vue"')
  })

  // ports MiddlewareTest::test_it_will_instruct_inertia_to_reload_on_a_version_mismatch
  // Laravel's `fullUrl()` of `/` is the bare base URL; ours is the absolute request URL.
  it('will instruct inertia to reload on a version mismatch', async () => {
    const { http } = await mockEndpoint({ version: '1234' })

    const response = await http().get('/').set({ ...inertiaHeaders, 'X-Inertia-Version': '4321' })

    expect(response.status).toBe(409)
    expect(response.headers['x-inertia-location']).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/)
    expect(response.headers['x-inertia-version']).toBe('1234')
    expect(response.text).toBe('')
  })

  // ports MiddlewareTest::test_validation_errors_are_registered_as_of_default
  // `errors` is shared as an always prop: it survives a partial reload that doesn't request it.
  it('validation errors are registered as of default', async () => {
    const { http } = await mockEndpoint()

    const response = await http()
      .get('/')
      .set({ ...inertiaHeaders, 'X-Inertia-Partial-Component': 'User/Edit', 'X-Inertia-Partial-Data': 'user' })

    expect(response.body.props).toHaveProperty('errors')
  })

  // ports MiddlewareTest::test_validation_errors_can_be_empty
  it('validation errors can be empty', async () => {
    const { http } = await mockEndpoint()

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.body.props.errors).toEqual({})
  })

  // ports MiddlewareTest::test_validation_errors_are_mapped_to_strings_by_default
  it('validation errors are mapped to strings by default', async () => {
    const { http } = await mockEndpoint({ session: { errors: structuredClone(errorBag) } })

    const errors = (await http().get('/').set(inertiaHeaders)).body.props.errors

    expect(errors.name).toBe('The name field is required.')
    expect(errors.email).toBe('Not a valid email address.')
  })

  // ports MiddlewareTest::test_validation_errors_can_remain_multiple_per_field
  // `WithAllErrorsMiddleware` (`$withAllErrors = true`) maps to the `withAllErrors` config option.
  it('validation errors can remain multiple per field', async () => {
    const { http } = await createApp({
      middleware: exampleMiddleware(),
      session: { errors: structuredClone(errorBag) },
      config: { withAllErrors: true },
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))],
    })

    const errors = (await http().get('/').set(inertiaHeaders)).body.props.errors

    expect(errors.name).toEqual(['The name field is required.'])
    expect(errors.email).toEqual(['Not a valid email address.', 'Another email error.'])
  })

  // ports MiddlewareTest::test_validation_errors_with_named_error_bags_are_scoped
  it('validation errors with named error bags are scoped', async () => {
    const { http } = await mockEndpoint({
      session: {
        errors: { example: { name: ['The name field is required.'], email: ['Not a valid email address.'] } },
      },
    })

    const errors = (await http().get('/').set(inertiaHeaders)).body.props.errors

    expect(errors.example.name).toBe('The name field is required.')
    expect(errors.example.email).toBe('Not a valid email address.')
  })

  // ports MiddlewareTest::test_default_validation_errors_can_be_overwritten
  it('default validation errors can be overwritten', async () => {
    const { http } = await mockEndpoint({
      shared: { errors: 'foo' },
      session: {
        errors: { example: { name: ['The name field is required.'], email: ['Not a valid email address.'] } },
      },
    })

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.body).toMatchObject({ props: { errors: 'foo' } })
  })

  // ports MiddlewareTest::test_validation_errors_are_scoped_to_error_bag_header
  it('validation errors are scoped to error bag header', async () => {
    const { http } = await mockEndpoint({
      session: {
        errors: { default: { name: ['The name field is required.'], email: ['Not a valid email address.'] } },
      },
    })

    const errors = (await http().get('/').set({ ...inertiaHeaders, 'X-Inertia-Error-Bag': 'example' })).body.props.errors

    expect(errors.example.name).toBe('The name field is required.')
    expect(errors.example.email).toBe('Not a valid email address.')
  })

  // ports MiddlewareTest::test_middleware_can_change_the_root_view_by_overriding_the_rootview_method
  it('middleware can change the root view by overriding the rootView method', async () => {
    @Injectable()
    class WelcomeMiddleware extends InertiaMiddleware {
      override rootView({ body }: RootViewContext) {
        return `<html data-view="welcome"><body>${body}</body></html>`
      }
    }

    const { http } = await createApp({
      middleware: WelcomeMiddleware,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit', { user: { name: 'Jonathan' } }))],
    })

    const response = await http().get('/')

    expect(response.status).toBe(200)
    expect(response.text).toContain('<html data-view="welcome">')
  })

  // ports MiddlewareTest::test_determine_the_version_by_a_hash_of_the_vite_manifest
  // Our manifest lives at `<public>/<build>/.vite/manifest.json` and is hashed with MD5
  // (Laravel: `public/build/manifest.json`, xxh128).
  it('determine the version by a hash of the vite manifest', async () => {
    const publicDirectory = mkdtempSync(join(tmpdir(), 'inertia-laravel-port-'))

    try {
      mkdirSync(join(publicDirectory, 'build', '.vite'), { recursive: true })
      // Laravel's `{"vite": true}` manifest, plus the entry chunk our asset tags need on a full visit.
      const contents = JSON.stringify({
        vite: true,
        'resources/js/app.tsx': { file: 'assets/app.js', src: 'resources/js/app.tsx', isEntry: true },
      })
      writeFileSync(join(publicDirectory, 'build', '.vite', 'manifest.json'), contents)

      const { http } = await createApp({
        config: { vite: { publicDirectory, buildDirectory: 'build' } },
        routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit', { user: { name: 'Jonathan' } }))],
      })

      const response = await http().get('/')

      expect(response.status).toBe(200)
      expect(pageOf(response).version).toBe(createHash('md5').update(contents).digest('hex'))
    } finally {
      rmSync(publicDirectory, { recursive: true, force: true })
    }
  })

  // ports MiddlewareTest::test_middleware_share_once
  // Our middleware has no separate `shareOnce()` hook: `share()` returns once props instead.
  it('middleware share once', async () => {
    @Injectable()
    class ShareOnceMiddleware extends InertiaMiddleware {
      override share() {
        return {
          permissions: Inertia.once(() => ({ admin: true })),
          settings: Inertia.once(() => ({ theme: 'dark' })).as('app-settings').until(60),
        }
      }
    }

    const { http } = await createApp({
      middleware: ShareOnceMiddleware,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))],
    })

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      props: { permissions: { admin: true }, settings: { theme: 'dark' } },
      onceProps: {
        permissions: { prop: 'permissions', expiresAt: null },
        'app-settings': { prop: 'settings' },
      },
    })
    expect(response.body.onceProps['app-settings'].expiresAt).not.toBeNull()
  })

  // ports MiddlewareTest::test_middleware_share_and_share_once_are_merged
  it('middleware share and share once are merged', async () => {
    @Injectable()
    class MergedShareMiddleware extends InertiaMiddleware {
      override share() {
        return {
          flash: () => ({ message: 'Hello' }),
          permissions: Inertia.once(() => ({ admin: true })),
        }
      }
    }

    const { http } = await createApp({
      middleware: MergedShareMiddleware,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))],
    })

    const response = await http().get('/').set(inertiaHeaders)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      props: { flash: { message: 'Hello' }, permissions: { admin: true } },
      onceProps: { permissions: { prop: 'permissions', expiresAt: null } },
    })
  })

  // ports MiddlewareTest::test_flash_data_is_preserved_on_non_inertia_redirect
  it('flash data is preserved on non inertia redirect', async () => {
    const { http } = await createApp({
      routes: [
        route('GET', '/action', ({ inertia }) => {
          inertia.flash('message', 'Success!')
          return inertia.redirect('/dashboard')
        }),
        route('GET', '/dashboard', ({ inertia }) => inertia.render('Dashboard')),
      ],
    })

    const redirect = await http().get('/action')
    expect(redirect.status).toBe(302)
    expect(redirect.headers.location).toBe('/dashboard')

    const response = await http().get('/dashboard').set(inertiaHeaders)
    expect(response.body).toMatchObject({ flash: { message: 'Success!' } })
  })

  // ports MiddlewareTest::test_redirect_with_hash_fragment_returns_409_for_inertia_requests
  // Laravel's `redirect()` absolutizes the URL; ours passes it through as given.
  it('redirect with hash fragment returns 409 for inertia requests', async () => {
    const { http } = await createApp({
      routes: [route('GET', '/action', ({ inertia }) => inertia.redirect('/article#section'))],
    })

    const response = await http().get('/action').set(inertiaHeaders)

    expect(response.status).toBe(409)
    expect(response.headers['x-inertia-redirect']).toBe('/article#section')
    expect(response.text).toBe('')
  })

  // ports MiddlewareTest::test_redirect_without_hash_fragment_is_not_intercepted
  it('redirect without hash fragment is not intercepted', async () => {
    const { http } = await createApp({
      routes: [route('POST', '/action', ({ inertia }) => inertia.redirect('/article'))],
    })

    const response = await http().post('/action').set(inertiaHeaders)

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/article')
  })

  // ports MiddlewareTest::test_redirect_with_hash_fragment_is_not_intercepted_for_non_inertia_requests
  it('redirect with hash fragment is not intercepted for non inertia requests', async () => {
    const { http } = await createApp({
      routes: [route('GET', '/action', ({ inertia }) => inertia.redirect('/article#section'))],
    })

    const response = await http().get('/action')

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/article#section')
  })

  // ports MiddlewareTest::test_post_redirect_with_hash_fragment_returns_409_for_inertia_requests
  it('post redirect with hash fragment returns 409 for inertia requests', async () => {
    const { http } = await createApp({
      routes: [route('POST', '/action', ({ inertia }) => inertia.redirect('/article#section'))],
    })

    const response = await http().post('/action').set(inertiaHeaders)

    expect(response.status).toBe(409)
    expect(response.headers['x-inertia-redirect']).toBe('/article#section')
  })

  // ports MiddlewareTest::test_redirect_with_hash_fragment_is_not_intercepted_for_prefetch_requests
  it('redirect with hash fragment is not intercepted for prefetch requests', async () => {
    const { http } = await createApp({
      routes: [route('GET', '/action', ({ inertia }) => inertia.redirect('/article#section'))],
    })

    const response = await http().get('/action').set({ ...inertiaHeaders, Purpose: 'prefetch' })

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/article#section')
  })

  // ports MiddlewareTest::test_the_vary_header_is_set
  it('the vary header is set', async () => {
    const { http } = await createApp({
      session: null,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))],
    })

    const response = await http().get('/')

    expect(response.headers.vary).toBe('X-Inertia')
  })

  // ports MiddlewareTest::test_existing_vary_header_values_are_preserved
  // `->setVary('Accept-Language')` (which replaces the header) maps to Nest's `@Header('Vary', ...)`.
  it('existing vary header values are preserved', async () => {
    const { http } = await createApp({
      session: null,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'), [Header('Vary', 'Accept-Language')])],
    })

    const response = await http().get('/')

    expect(varyTokens(response.headers.vary)).toEqual(['Accept-Language', 'X-Inertia'])
  })

  // ports MiddlewareTest::test_the_vary_header_is_not_duplicated
  it('the vary header is not duplicated', async () => {
    const { http } = await createApp({
      session: null,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'), [Header('Vary', 'X-Inertia')])],
    })

    const response = await http().get('/')

    expect(response.headers.vary).toBe('X-Inertia')
  })

  // ports MiddlewareTest::test_empty_vary_header_values_are_discarded
  it('empty vary header values are discarded', async () => {
    const { http } = await createApp({
      session: null,
      routes: [route('GET', '/', ({ inertia }) => inertia.render('User/Edit'), [Header('Vary', '')])],
    })

    const response = await http().get('/')

    expect(response.headers.vary).toBe('X-Inertia')
  })

  // ports MiddlewareTest::test_existing_vary_header_values_are_preserved_on_precognitive_routes
  it('existing vary header values are preserved on precognitive routes', async () => {
    const { http } = await createApp({
      session: null,
      routes: [
        route('GET', '/', ({ inertia }) => inertia.render('User/Edit'), [
          Precognitive(),
          Header('Vary', 'Accept-Language'),
        ]),
      ],
    })

    const response = await http().get('/')

    expect(varyTokens(response.headers.vary)).toEqual(['Accept-Language', 'Precognition', 'X-Inertia'])
  })
})
