// Ported from inertia-laravel v3.7.0 — tests/ResponseFactoryTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ResponseFactoryTest.php
//
// `Inertia::share()/flash()/render()` (the ResponseFactory facade) map to the
// per-request `InertiaContext`; the prop factories (`Inertia::defer()` etc.) map
// to `Inertia.defer()` etc. `Route::middleware([StartSession::class, ExampleMiddleware::class])`
// maps to `createApp({ middleware: exampleMiddleware(), routes })`, with an in-memory session.
import {
  AlwaysProp,
  DeferProp,
  Inertia,
  MergeProp,
  OnceProp,
  OptionalProp,
  ScrollProp,
} from '../../src/index.js'
import { closeApps, createApp, exampleMiddleware, inertiaHeaders, route, visit } from './helpers.js'

afterEach(closeApps)

const app = (routes: Parameters<typeof route>[], config = {}) =>
  createApp({ middleware: exampleMiddleware(), routes: routes.map((args) => route(...args)), config })

describe('ResponseFactoryTest (inertia-laravel v3.7.0)', () => {
  // ports ResponseFactoryTest::test_location_response_for_inertia_requests
  it('location response for inertia requests', async () => {
    const response = await visit('/', (inertia) => inertia.location('https://inertiajs.com'), { headers: inertiaHeaders })

    expect(response.status).toBe(409)
    expect(response.headers['x-inertia-location']).toBe('https://inertiajs.com')
  })

  // ports ResponseFactoryTest::test_location_response_for_non_inertia_requests
  it('location response for non inertia requests', async () => {
    const response = await visit('/', (inertia) => inertia.location('https://inertiajs.com'))

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('https://inertiajs.com')
  })

  // ports ResponseFactoryTest::test_location_redirects_are_not_modified
  it('location redirects are not modified', async () => {
    const response = await visit('/', (inertia) => inertia.location('/foo'))

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/foo')
  })

  // ports ResponseFactoryTest::test_the_version_can_be_a_closure
  it('the version can be a closure', async () => {
    const versionsSeenByHandler: string[] = []
    const { http } = await app([
      [
        'GET',
        '/',
        async ({ inertia }) => {
          versionsSeenByHandler.push(await inertia.getVersion())
          inertia.setVersion('f445bd0a2c393a5af14fc677f59980a9')

          return inertia.render('User/Edit')
        },
      ],
    ])

    const response = await http().get('/').set({ ...inertiaHeaders, 'X-Inertia-Version': 'f445bd0a2c393a5af14fc677f59980a9' })

    expect(versionsSeenByHandler).toEqual([''])
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ component: 'User/Edit' })
  })

  // ports ResponseFactoryTest::test_shared_data_can_be_shared_from_anywhere
  it('shared data can be shared from anywhere', async () => {
    const { http } = await app([['GET', '/', ({ inertia }) => inertia.share('foo', 'bar').render('User/Edit')]])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', props: { foo: 'bar' } })
  })

  // ports ResponseFactoryTest::test_dot_props_are_merged_from_shared
  it('dot props are merged from shared', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) =>
          inertia.share('auth.user', { name: 'Jonathan' }).render('User/Edit', { 'auth.user.can.create_group': false }),
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { auth: { user: { name: 'Jonathan', can: { create_group: false } } } },
    })
  })

  // ports ResponseFactoryTest::test_shared_data_can_resolve_closure_arguments
  // Our closures take no arguments; the request is captured instead of injected.
  it('shared data can resolve closure arguments', async () => {
    const { http } = await app([
      ['GET', '/', ({ inertia, req }) => inertia.share('query', () => req.query).render('User/Edit')],
    ])

    const response = await http().get('/?foo=bar').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', props: { query: { foo: 'bar' } } })
  })

  // ports ResponseFactoryTest::test_dot_props_with_callbacks_are_merged_from_shared
  it('dot props with callbacks are merged from shared', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) =>
          inertia
            .share('auth.user', () => ({ name: 'Jonathan' }))
            .render('User/Edit', { 'auth.user.can.create_group': false }),
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { auth: { user: { name: 'Jonathan', can: { create_group: false } } } },
    })
  })

  // ports ResponseFactoryTest::test_can_create_deferred_prop
  it('can create deferred prop', () => {
    const deferredProp = Inertia.defer(() => 'A deferred value')

    expect(deferredProp).toBeInstanceOf(DeferProp)
    expect(deferredProp.group()).toBe('default')
  })

  // ports ResponseFactoryTest::test_can_create_deferred_prop_with_custom_group
  it('can create deferred prop with custom group', () => {
    const deferredProp = Inertia.defer(() => 'A deferred value', 'foo')

    expect(deferredProp).toBeInstanceOf(DeferProp)
    expect(deferredProp.group()).toBe('foo')
  })

  // ports ResponseFactoryTest::test_can_create_merged_prop
  it('can create merged prop', () => {
    expect(Inertia.merge(() => 'A merged value')).toBeInstanceOf(MergeProp)
  })

  // ports ResponseFactoryTest::test_can_create_deep_merged_prop
  it('can create deep merged prop', () => {
    expect(Inertia.deepMerge(() => 'A merged value')).toBeInstanceOf(MergeProp)
  })

  // ports ResponseFactoryTest::test_can_create_deferred_and_merged_prop
  it('can create deferred and merged prop', () => {
    expect(Inertia.defer(() => 'A deferred + merged value').merge()).toBeInstanceOf(DeferProp)
  })

  // ports ResponseFactoryTest::test_can_create_deferred_and_deep_merged_prop
  it('can create deferred and deep merged prop', () => {
    expect(Inertia.defer(() => 'A deferred + merged value').deepMerge()).toBeInstanceOf(DeferProp)
  })

  // ports ResponseFactoryTest::test_can_create_optional_prop
  it('can create optional prop', () => {
    expect(Inertia.optional(() => 'An optional value')).toBeInstanceOf(OptionalProp)
  })

  // ports ResponseFactoryTest::test_can_create_scroll_prop
  it('can create scroll prop', async () => {
    const data = ['item1', 'item2']
    const scrollProp = Inertia.scroll(data)

    expect(scrollProp).toBeInstanceOf(ScrollProp)
    expect(await scrollProp.resolve()).toBe(data)
  })

  // ports ResponseFactoryTest::test_can_create_scroll_prop_with_metadata_provider
  it('can create scroll prop with metadata provider', async () => {
    const data = ['item1', 'item2']
    const scrollProp = Inertia.scroll(data, {
      wrapper: 'data',
      metadata: { pageName: 'custom', previousPage: 1, nextPage: 3, currentPage: 2 },
    })

    expect(scrollProp).toBeInstanceOf(ScrollProp)
    expect(await scrollProp.resolve()).toBe(data)
    expect(await scrollProp.metadata()).toEqual({ pageName: 'custom', previousPage: 1, nextPage: 3, currentPage: 2 })
  })

  // ports ResponseFactoryTest::test_can_create_once_prop
  it('can create once prop', () => {
    expect(Inertia.once(() => 'A once value')).toBeInstanceOf(OnceProp)
  })

  // ports ResponseFactoryTest::test_can_create_deferred_and_once_prop
  it('can create deferred and once prop', () => {
    const deferredProp = Inertia.defer(() => 'A deferred + once value').once()

    expect(deferredProp).toBeInstanceOf(DeferProp)
    expect(deferredProp.shouldResolveOnce()).toBe(true)
  })

  // ports ResponseFactoryTest::test_can_create_always_prop
  it('can create always prop', () => {
    expect(Inertia.always(() => 'An always value')).toBeInstanceOf(AlwaysProp)
  })

  // ports ResponseFactoryTest::test_share_once_shares_a_once_prop
  it('share once shares a once prop', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => {
          inertia.shareOnce('settings', () => ({ theme: 'dark' }))
          return inertia.render('User/Edit')
        },
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { settings: { theme: 'dark' } },
      onceProps: { settings: { prop: 'settings', expiresAt: null } },
    })
  })

  // ports ResponseFactoryTest::test_share_once_is_chainable
  it('share once is chainable', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => {
          const prop = inertia
            .shareOnce('settings', () => ({ theme: 'dark' }))
            .as('app-settings')
            .until(60)

          expect(prop).toBeInstanceOf(OnceProp)

          return inertia.render('User/Edit')
        },
      ],
    ])

    const data = (await http().get('/').set(inertiaHeaders).expect(200)).body

    expect(data).toHaveProperty('onceProps')
    expect(data.onceProps).toHaveProperty('app-settings')
    expect(data.onceProps['app-settings'].prop).toBe('settings')
    expect(data.onceProps['app-settings'].expiresAt).not.toBeNull()
  })

  // ports ResponseFactoryTest::test_forcefully_refreshing_a_once_prop_includes_it_in_once_props
  it('forcefully refreshing a once prop includes it in once props', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => inertia.render('User/Edit', { settings: Inertia.once(() => ({ theme: 'dark' })).fresh() }),
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { settings: { theme: 'dark' } },
      onceProps: { settings: { prop: 'settings', expiresAt: null } },
    })
  })

  // ports ResponseFactoryTest::test_once_prop_is_included_in_once_props_by_default
  it('once prop is included in once props by default', async () => {
    const { http } = await app([
      ['GET', '/', ({ inertia }) => inertia.render('User/Edit', { settings: Inertia.once(() => ({ theme: 'dark' })) })],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { settings: { theme: 'dark' } },
      onceProps: { settings: { prop: 'settings', expiresAt: null } },
    })
  })

  // ports ResponseFactoryTest::test_flash_data_is_flashed_to_session_on_redirect
  it('flash data is flashed to session on redirect', async () => {
    const { http, session } = await app([
      ['POST', '/flash-test', ({ inertia }) => inertia.flash({ message: 'Success!' }).back()],
    ])

    const response = await http().post('/flash-test').set(inertiaHeaders)

    expect(response.status).toBe(302)
    expect(session.flash).toEqual({ message: 'Success!' })
  })

  // ports ResponseFactoryTest::test_render_with_flash_includes_flash_in_page
  // `Inertia::render(...)->flash([...])` maps to flashing on the context before rendering.
  it('render with flash includes flash in page', async () => {
    const { http, session } = await app([
      [
        'POST',
        '/flash-test',
        ({ inertia }) =>
          inertia.flash('type', 'success').flash({ message: 'User updated!' }).render('User/Edit', { user: 'Jonathan' }),
      ],
    ])

    const response = await http().post('/flash-test').set(inertiaHeaders)

    expect(response.status).toBeLessThan(300)
    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { user: 'Jonathan' },
      flash: { message: 'User updated!', type: 'success' },
    })
    expect(session.flash).toBeUndefined()
  })

  // ports ResponseFactoryTest::test_big_integers_in_flash_data_are_wrapped_when_enabled
  it('big integers in flash data are wrapped when enabled', async () => {
    const { http } = await app(
      [
        [
          'POST',
          '/flash-big-integer',
          ({ inertia }) => inertia.flash('id', 900719925474099988n).flash('safe', 42).render('User/Edit'),
        ],
      ],
      { preserveBigIntegers: true },
    )

    const response = await http().post('/flash-big-integer').set(inertiaHeaders)

    expect(response.status).toBeLessThan(300)
    expect(response.body).toMatchObject({ flash: { id: { $bigint: '900719925474099988' }, safe: 42 } })
  })

  // ports ResponseFactoryTest::test_big_integers_can_be_preserved_for_a_single_response
  it('big integers can be preserved for a single response', async () => {
    const { http } = await app(
      [['GET', '/one-page', ({ inertia }) => inertia.render('User/Edit', { id: 900719925474099988n }).preserveBigIntegers()]],
      { preserveBigIntegers: false },
    )

    const response = await http().get('/one-page').set(inertiaHeaders)

    expect(response.body).toMatchObject({
      props: { id: { $bigint: '900719925474099988' } },
      preserveBigIntegers: true,
    })
  })

  // ports ResponseFactoryTest::test_a_single_response_can_opt_out_of_preserving_big_integers
  // JS cannot emit a raw 64-bit integer (a `bigint` is not JSON-serializable without the
  // markers), so only the "flag is absent" half translates; a safe integer stands in.
  it('a single response can opt out of preserving big integers', async () => {
    const { http } = await app(
      [['GET', '/opted-out', ({ inertia }) => inertia.render('User/Edit', { id: 42 }).preserveBigIntegers(false)]],
      { preserveBigIntegers: true },
    )

    const response = await http().get('/opted-out').set(inertiaHeaders)

    expect(response.body).toMatchObject({ props: { id: 42 } })
    expect(response.body).not.toHaveProperty('preserveBigIntegers')
  })

  // ports ResponseFactoryTest::test_the_initial_page_tells_the_client_when_big_integers_may_be_wrapped
  it('the initial page tells the client when big integers may be wrapped', async () => {
    const { http } = await app(
      [['GET', '/root', ({ inertia }) => inertia.render('User/Edit', { id: 900719925474099988n })]],
      { preserveBigIntegers: true },
    )

    const response = await http().get('/root')

    expect(response.text).toContain('"preserveBigIntegers":true')
  })

  // ports ResponseFactoryTest::test_the_initial_page_is_unmarked_when_big_integers_are_disabled
  // A safe integer stands in for the PHP int (see the opt-out test above).
  it('the initial page is unmarked when big integers are disabled', async () => {
    const { http } = await app([['GET', '/root', ({ inertia }) => inertia.render('User/Edit', { id: 42 })]], {
      preserveBigIntegers: false,
    })

    const response = await http().get('/root')

    expect(response.text).not.toContain('preserveBigIntegers')
  })

  // ports ResponseFactoryTest::test_render_without_flash_does_not_include_flash_key
  it('render without flash does not include flash key', async () => {
    const { http } = await app([['GET', '/no-flash', ({ inertia }) => inertia.render('User/Edit', { user: 'Jonathan' })]])

    const response = await http().get('/no-flash').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit' })
    expect(response.body).not.toHaveProperty('flash')
  })

  // ports ResponseFactoryTest::test_multiple_flash_calls_are_merged
  it('multiple flash calls are merged', async () => {
    const { http } = await app([
      [
        'POST',
        '/create',
        ({ inertia }) => {
          inertia.flash('foo', 'value1')
          inertia.flash('bar', 'value2')

          return inertia.render('User/Show')
        },
      ],
    ])

    const response = await http().post('/create').set(inertiaHeaders)

    expect(response.body).toMatchObject({ flash: { foo: 'value1', bar: 'value2' } })
  })

  // ports ResponseFactoryTest::test_shared_props_tracking_can_be_disabled
  it('shared props tracking can be disabled', async () => {
    const { http } = await app([['GET', '/', ({ inertia }) => inertia.share('app_name', 'My App').render('User/Edit')]], {
      exposeSharedPropKeys: false,
    })

    const data = (await http().get('/').set(inertiaHeaders).expect(200)).body

    expect(data).not.toHaveProperty('sharedProps')
    expect(data.props.app_name).toBe('My App')
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_keys_from_middleware_share
  it('shared props metadata includes keys from middleware share', async () => {
    const { http } = await app([['GET', '/', ({ inertia }) => inertia.render('User/Edit', { user: { name: 'Jonathan' } })]])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({
      component: 'User/Edit',
      props: { user: { name: 'Jonathan' } },
      sharedProps: ['errors'],
    })
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_keys_from_inertia_share
  it('shared props metadata includes keys from inertia share', async () => {
    const { http } = await app([['GET', '/', ({ inertia }) => inertia.share('app_name', 'My App').render('User/Edit')]])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body.sharedProps).toEqual(['errors', 'app_name'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_dot_notation_keys_as_top_level
  it('shared props metadata includes dot notation keys as top level', async () => {
    const { http } = await app([
      ['GET', '/', ({ inertia }) => inertia.share('auth.user', { name: 'Jonathan' }).render('User/Edit')],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body.sharedProps).toEqual(['errors', 'auth'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_keys_from_share_once
  it('shared props metadata includes keys from share once', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => {
          inertia.shareOnce('permissions', () => ({ admin: true }))
          return inertia.render('User/Edit')
        },
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ props: { permissions: { admin: true } } })
    expect(response.body.sharedProps).toEqual(['errors', 'permissions'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_page_specific_override_keys
  it('shared props metadata includes page specific override keys', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => inertia.share('auth', { user: null }).render('User/Edit', { auth: { user: { name: 'Jonathan' } } }),
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ props: { auth: { user: { name: 'Jonathan' } } } })
    expect(response.body.sharedProps).toEqual(['errors', 'auth'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_with_multiple_share_calls
  it('shared props metadata with multiple share calls', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => {
          inertia.share('app_name', 'My App')
          inertia.share('locale', 'en')
          inertia.shareOnce('permissions', () => ({ admin: true }))

          return inertia.render('User/Edit')
        },
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body.sharedProps).toEqual(['errors', 'app_name', 'locale', 'permissions'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_with_array_share
  it('shared props metadata with array share', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) =>
          inertia
            .share({ flash: () => ({ message: 'Hello' }), auth: () => ({ user: { name: 'Jonathan' } }) })
            .render('User/Edit'),
      ],
    ])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body.sharedProps).toEqual(['errors', 'flash', 'auth'])
  })

  // ports ResponseFactoryTest::test_shared_props_metadata_includes_already_loaded_once_props
  it('shared props metadata includes already loaded once props', async () => {
    const { http } = await app([
      [
        'GET',
        '/',
        ({ inertia }) => {
          inertia.shareOnce('permissions', () => ({ admin: true }))
          return inertia.render('User/Edit')
        },
      ],
    ])

    const data = (
      await http()
        .get('/')
        .set({ ...inertiaHeaders, 'X-Inertia-Except-Once-Props': 'permissions' })
        .expect(200)
    ).body

    expect(data.props).not.toHaveProperty('permissions')
    expect(data.sharedProps).toContain('permissions')
    expect(data.onceProps).toHaveProperty('permissions')
  })
})
