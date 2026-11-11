// Ported from inertia-laravel v3.7.0 — tests/ResponseTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ResponseTest.php
//
// `(new Response($component, [], $props, 'app', '123'))->toResponse($request)`
// maps to `visit(url, (inertia) => inertia.render(component, props), { version: '123' })`:
// an `InertiaContext` on a real Express request, rendering only the `@inertia` body.
//
// Translation note: our context always shares `errors` (Laravel does the same in
// `Inertia\Middleware::share()`, which `new Response(...)` bypasses). Every page
// therefore carries `props.errors = {}` and `sharedProps: ["errors"]`, and the
// exact-HTML assertions below include them.
import { AlwaysProp, DeferProp, Inertia, MergeProp, OptionalProp, ScrollProp } from '../../src/index.js'
import { pageOf, scrollMetadata, visit, type VisitOptions } from './helpers.js'

const inertia = { 'X-Inertia': 'true' }

const partial = (component: string, headers: Record<string, string>) => ({
  ...inertia,
  'X-Inertia-Partial-Component': component,
  ...headers,
})

/** The `@inertia` directive output for a page JSON string. */
const directive = (json: string) => `<script data-page="app" type="application/json">${json}</script><div id="app"></div>`

function render(
  url: string,
  component: string,
  props: Record<string, unknown>,
  options: VisitOptions = {},
) {
  return visit(url, (context) => context.render(component, props), { version: '123', ...options })
}

describe('ResponseTest (inertia-laravel v3.7.0)', () => {
  // ports ResponseTest::test_server_response
  it('server response', async () => {
    const response = await render('/user/123', 'User/Edit', { user: { name: 'Jonathan' } })
    const page = pageOf(response)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/html/)
    expect(page.component).toBe('User/Edit')
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
    expect(page).not.toHaveProperty('clearHistory')
    expect(page).not.toHaveProperty('encryptHistory')
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"}},"url":"\\/user\\/123","version":"123","sharedProps":["errors"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_deferred_prop
  it('server response with deferred prop', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new DeferProp(() => 'bar', 'default'),
    })
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
    expect(page.deferredProps).toEqual({ default: ['foo'] })
    expect(page).not.toHaveProperty('clearHistory')
    expect(page).not.toHaveProperty('encryptHistory')
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"}},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"deferredProps":{"default":["foo"]}}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_deferred_prop_and_multiple_groups
  it('server response with deferred prop and multiple groups', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new DeferProp(() => 'foo value', 'default'),
      bar: new DeferProp(() => 'bar value', 'default'),
      baz: new DeferProp(() => 'baz value', 'custom'),
    })
    const page = pageOf(response)

    expect(page.deferredProps).toEqual({ default: ['foo', 'bar'], custom: ['baz'] })
    expect(page).not.toHaveProperty('clearHistory')
    expect(page).not.toHaveProperty('encryptHistory')
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"}},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"deferredProps":{"default":["foo","bar"],"custom":["baz"]}}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_scroll_props (data provider: resetUsersProp)
  it.each([
    ['no reset', false],
    ['with reset', true],
  ])('server response with scroll props (%s)', async (_label, resetUsersProp) => {
    const response = await render(
      '/user/123',
      'User/Index',
      { users: new ScrollProp({ data: [{ id: 1 }] }, 'data', scrollMetadata()) },
      { headers: resetUsersProp ? { 'X-Inertia-Reset': 'users' } : {} },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Index')
    expect(page.props.users).toEqual({ data: [{ id: 1 }] })
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
    expect(page.scrollProps).toEqual({
      users: { pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1, reset: resetUsersProp },
    })
  })

  // ports ResponseTest::test_server_response_with_merge_props
  it('server response with merge props', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp('foo value'),
      bar: new MergeProp('bar value'),
    })

    expect(pageOf(response).mergeProps).toEqual(['foo', 'bar'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":"foo value","bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"mergeProps":["foo","bar"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_merge_props_that_should_prepend
  it('server response with merge props that should prepend', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp('foo value').prepend(),
      bar: new MergeProp('bar value'),
    })
    const page = pageOf(response)

    expect(page.mergeProps).toEqual(['bar'])
    expect(page.prependProps).toEqual(['foo'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":"foo value","bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"mergeProps":["bar"],"prependProps":["foo"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_merge_props_that_has_nested_paths_to_append_and_prepend
  it('server response with merge props that has nested paths to append and prepend', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp({ data: [{ id: 1 }, { id: 2 }] }).append('data'),
      bar: new MergeProp({ data: { items: [{ uuid: 1 }, { uuid: 2 }] } }).prepend('data.items'),
    })
    const page = pageOf(response)

    expect(page.mergeProps).toEqual(['foo.data'])
    expect(page.prependProps).toEqual(['bar.data.items'])
    expect(page).not.toHaveProperty('matchPropsOn')
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":{"data":[{"id":1},{"id":2}]},"bar":{"data":{"items":[{"uuid":1},{"uuid":2}]}}},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"mergeProps":["foo.data"],"prependProps":["bar.data.items"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_merge_props_that_has_nested_paths_to_append_and_prepend_with_match_on_strategies
  it('server response with merge props that has nested paths to append and prepend with match on strategies', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp({ data: [{ id: 1 }, { id: 2 }] }).append('data', 'id'),
      bar: new MergeProp({ data: { items: [{ uuid: 1 }, { uuid: 2 }] } }).prepend('data.items', 'uuid'),
    })
    const page = pageOf(response)

    expect(page.mergeProps).toEqual(['foo.data'])
    expect(page.prependProps).toEqual(['bar.data.items'])
    expect(page.matchPropsOn).toEqual(['foo.data.id', 'bar.data.items.uuid'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":{"data":[{"id":1},{"id":2}]},"bar":{"data":{"items":[{"uuid":1},{"uuid":2}]}}},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"mergeProps":["foo.data"],"prependProps":["bar.data.items"],"matchPropsOn":["foo.data.id","bar.data.items.uuid"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_deep_merge_props
  it('server response with deep merge props', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp('foo value').deepMerge(),
      bar: new MergeProp('bar value').deepMerge(),
    })

    expect(pageOf(response).deepMergeProps).toEqual(['foo', 'bar'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":"foo value","bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"deepMergeProps":["foo","bar"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_match_on_props
  it('server response with match on props', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new MergeProp('foo value').matchOn('foo-key').deepMerge(),
      bar: new MergeProp('bar value').matchOn('bar-key').deepMerge(),
    })
    const page = pageOf(response)

    expect(page.deepMergeProps).toEqual(['foo', 'bar'])
    expect(page.matchPropsOn).toEqual(['foo.foo-key', 'bar.bar-key'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"foo":"foo value","bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"deepMergeProps":["foo","bar"],"matchPropsOn":["foo.foo-key","bar.bar-key"]}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_defer_and_merge_props
  it('server response with defer and merge props', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new DeferProp(() => 'foo value', 'default').merge(),
      bar: new MergeProp('bar value'),
    })
    const page = pageOf(response)

    expect(page.deferredProps).toEqual({ default: ['foo'] })
    expect(page.mergeProps).toEqual(['foo', 'bar'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"mergeProps":["foo","bar"],"deferredProps":{"default":["foo"]}}',
      ),
    )
  })

  // ports ResponseTest::test_server_response_with_defer_and_deep_merge_props
  it('server response with defer and deep merge props', async () => {
    const response = await render('/user/123', 'User/Edit', {
      user: { name: 'Jonathan' },
      foo: new DeferProp(() => 'foo value', 'default').deepMerge(),
      bar: new MergeProp('bar value').deepMerge(),
    })
    const page = pageOf(response)

    expect(page.deferredProps).toEqual({ default: ['foo'] })
    expect(page.deepMergeProps).toEqual(['foo', 'bar'])
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"user":{"name":"Jonathan"},"bar":"bar value"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"deepMergeProps":["foo","bar"],"deferredProps":{"default":["foo"]}}',
      ),
    )
  })

  // ports ResponseTest::test_exclude_merge_props_from_partial_only_response
  it('exclude merge props from partial only response', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: { name: 'Jonathan' }, foo: new MergeProp('foo value'), bar: new MergeProp('bar value') },
      { headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'user' }) },
    )
    const page = pageOf(response)

    expect(response.headers['content-type']).toMatch(/json/)
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.props).not.toHaveProperty('foo')
    expect(page.props).not.toHaveProperty('bar')
    expect(page).not.toHaveProperty('mergeProps')
  })

  // ports ResponseTest::test_exclude_merge_props_from_partial_except_response
  it('exclude merge props from partial except response', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: { name: 'Jonathan' }, foo: new MergeProp('foo value'), bar: new MergeProp('bar value') },
      { headers: partial('User/Edit', { 'X-Inertia-Partial-Except': 'foo' }) },
    )
    const page = pageOf(response)

    expect(page.props.user.name).toBe('Jonathan')
    expect(page.props).not.toHaveProperty('foo')
    expect(page.props).toHaveProperty('bar')
    expect(page.mergeProps).toEqual(['bar'])
  })

  // ports ResponseTest::test_exclude_merge_props_when_passed_in_reset_header
  it('exclude merge props when passed in reset header', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: { name: 'Jonathan' }, foo: new MergeProp('foo value'), bar: new MergeProp('bar value') },
      { headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'foo', 'X-Inertia-Reset': 'foo' }) },
    )
    const page = pageOf(response)

    expect(page.props.foo).toBe('foo value')
    expect(page.props).not.toHaveProperty('bar')
    expect(page).not.toHaveProperty('mergeProps')
  })

  // ports ResponseTest::test_xhr_response
  it('xhr response', async () => {
    const response = await render('/user/123', 'User/Edit', { user: { name: 'Jonathan' } }, { headers: inertia })
    const page = pageOf(response)

    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.headers['x-inertia']).toBe('true')
    expect(page.component).toBe('User/Edit')
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
  })

  // ports ResponseTest::test_xhr_response_with_deferred_props_includes_deferred_metadata
  it('xhr response with deferred props includes deferred metadata', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      {
        user: { name: 'Jonathan' },
        results: new DeferProp(() => ({ data: ['item1', 'item2'] }), 'default'),
      },
      { headers: inertia },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.props).not.toHaveProperty('results')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
    expect(page.deferredProps).toEqual({ default: ['results'] })
  })

  // ports ResponseTest::test_optional_callable_resource_response
  it('optional callable resource response', async () => {
    const response = await render(
      '/users',
      'User/Index',
      { users: () => [{ name: 'Jonathan' }], organizations: () => [{ name: 'Inertia' }] },
      { headers: inertia },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Index')
    expect(page.url).toBe('/users')
    expect(page.version).toBe('123')
    expect(JSON.stringify(page.props.users)).toBe(JSON.stringify([{ name: 'Jonathan' }]))
    expect(JSON.stringify(page.props.organizations)).toBe(JSON.stringify([{ name: 'Inertia' }]))
  })

  // ports ResponseTest::test_optional_callable_resource_partial_response
  it('optional callable resource partial response', async () => {
    const response = await render(
      '/users',
      'User/Index',
      { users: () => [{ name: 'Jonathan' }], organizations: () => [{ name: 'Inertia' }] },
      { headers: partial('User/Index', { 'X-Inertia-Partial-Data': 'users' }) },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Index')
    expect(page.url).toBe('/users')
    expect(page.version).toBe('123')
    expect(page.props).not.toHaveProperty('organizations')
    expect(JSON.stringify(page.props.users)).toBe(JSON.stringify([{ name: 'Jonathan' }]))
  })

  // ports ResponseTest::test_promise_props_are_resolved
  it('promise props are resolved', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: Promise.resolve({ name: 'Jonathan' }) },
      { headers: inertia },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props.user.name).toBe('Jonathan')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
  })

  // ports ResponseTest::test_xhr_partial_response
  // Laravel asserts `assertCount(1, $props)`; our always-shared `errors` makes it 2.
  it('xhr partial response', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: { name: 'Jonathan' }, partial: 'partial-data' },
      { headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'partial' }) },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props).toEqual({ errors: {}, partial: 'partial-data' })
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
  })

  // ports ResponseTest::test_exclude_props_from_partial_response
  it('exclude props from partial response', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      { user: { name: 'Jonathan' }, partial: 'partial-data' },
      { headers: partial('User/Edit', { 'X-Inertia-Partial-Except': 'user' }) },
    )
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props).toEqual({ errors: {}, partial: 'partial-data' })
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
  })

  // ports ResponseTest::test_nested_closures_are_resolved
  it('nested closures are resolved', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { auth: { user: () => ({ name: 'Jonathan' }), token: 'value' } }),
    )

    expect(page.props.auth.user.name).toBe('Jonathan')
    expect(page.props.auth.token).toBe('value')
  })

  // ports ResponseTest::test_double_nested_closures_are_resolved
  it('double nested closures are resolved', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { auth: () => ({ user: () => ({ name: 'Jonathan' }), token: 'value' }) }),
    )

    expect(page.props.auth.user.name).toBe('Jonathan')
    expect(page.props.auth.token).toBe('value')
  })

  // ports ResponseTest::test_nested_optional_prop_inside_closure_is_excluded
  it('nested optional prop inside closure is excluded', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', {
        auth: () => ({ user: { name: 'Jonathan' }, pending: Inertia.optional(() => 'secret') }),
      }),
    )

    expect(page.props.auth.user.name).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('pending')
  })

  // ports ResponseTest::test_nested_partial_props
  it('nested partial props', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      {
        auth: {
          user: new OptionalProp(() => ({ name: 'Jonathan Reinink', email: 'jonathan@example.com' })),
          refresh_token: 'value',
          token: 'value',
        },
        shared: { flash: 'value' },
      },
      { version: '', headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'auth.user,auth.refresh_token' }) },
    )
    const page = pageOf(response)

    expect(page.props).not.toHaveProperty('shared')
    expect(page.props.auth).not.toHaveProperty('token')
    expect(page.props.auth.user.name).toBe('Jonathan Reinink')
    expect(page.props.auth.user.email).toBe('jonathan@example.com')
    expect(page.props.auth.refresh_token).toBe('value')
  })

  // ports ResponseTest::test_exclude_nested_props_from_partial_response
  it('exclude nested props from partial response', async () => {
    const response = await render(
      '/user/123',
      'User/Edit',
      {
        auth: {
          user: new OptionalProp(() => ({ name: 'Jonathan Reinink', email: 'jonathan@example.com' })),
          refresh_token: 'value',
        },
        shared: { flash: 'value' },
      },
      {
        version: '',
        headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'auth', 'X-Inertia-Partial-Except': 'auth.user' }),
      },
    )
    const page = pageOf(response)

    expect(page.props.auth).not.toHaveProperty('user')
    expect(page.props).not.toHaveProperty('shared')
    expect(page.props.auth.refresh_token).toBe('value')
  })

  // ports ResponseTest::test_optional_props_are_not_included_by_default
  it('optional props are not included by default', async () => {
    const page = pageOf(
      await render(
        '/users',
        'Users',
        { users: [], optional: new OptionalProp(() => 'An optional value') },
        { headers: inertia },
      ),
    )

    expect(page.props.users).toEqual([])
    expect(page.props).not.toHaveProperty('optional')
  })

  // ports ResponseTest::test_optional_props_are_included_in_partial_reload
  it('optional props are included in partial reload', async () => {
    const page = pageOf(
      await render(
        '/users',
        'Users',
        { users: [], optional: new OptionalProp(() => 'An optional value') },
        { headers: partial('Users', { 'X-Inertia-Partial-Data': 'optional' }) },
      ),
    )

    expect(page.props).not.toHaveProperty('users')
    expect(page.props.optional).toBe('An optional value')
  })

  // ports ResponseTest::test_defer_arrayable_props_are_resolved_in_partial_reload
  // `Arrayable` maps to an object with `toJSON()`.
  it('defer arrayable props are resolved in partial reload', async () => {
    const page = pageOf(
      await render(
        '/users',
        'Users',
        { users: [], defer: new DeferProp(() => ({ toJSON: () => ({ foo: 'bar' }) })) },
        { headers: partial('Users', { 'X-Inertia-Partial-Data': 'defer' }) },
      ),
    )

    expect(page.props).not.toHaveProperty('users')
    expect(page.props.defer).toEqual({ foo: 'bar' })
  })

  // ports ResponseTest::test_always_props_are_included_on_partial_reload
  it('always props are included on partial reload', async () => {
    const page = pageOf(
      await render(
        '/user/123',
        'User/Edit',
        {
          user: new OptionalProp(() => ({ name: 'Jonathan Reinink', email: 'jonathan@example.com' })),
          data: { name: 'Taylor Otwell' },
          errors: new AlwaysProp(() => ({ name: 'The email field is required.' })),
        },
        { headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'data' }) },
      ),
    )

    expect(page.props.errors.name).toBe('The email field is required.')
    expect(page.props.data.name).toBe('Taylor Otwell')
    expect(page.props).not.toHaveProperty('user')
  })

  // ports ResponseTest::test_top_level_dot_props_get_unpacked
  it('top level dot props get unpacked', async () => {
    const page = pageOf(
      await render(
        '/products/123',
        'User/Edit',
        {
          auth: { user: { name: 'Jonathan Reinink' } },
          'auth.user.can': { 'do.stuff': true },
          product: { name: 'My example product' },
        },
        { headers: inertia },
      ),
    )

    const user = page.props.auth.user
    expect(user.name).toBe('Jonathan Reinink')
    expect(user.can['do.stuff']).toBe(true)
    expect(page.props).not.toHaveProperty(['auth.user.can'])
  })

  // ports ResponseTest::test_nested_dot_props_do_not_get_unpacked
  it('nested dot props do not get unpacked', async () => {
    const page = pageOf(
      await render(
        '/products/123',
        'User/Edit',
        {
          auth: { 'user.can': { 'do.stuff': true }, user: { name: 'Jonathan Reinink' } },
          product: { name: 'My example product' },
        },
        { headers: inertia },
      ),
    )

    const auth = page.props.auth
    expect(auth.user.name).toBe('Jonathan Reinink')
    expect(auth['user.can']['do.stuff']).toBe(true)
    expect(auth).not.toHaveProperty('can')
  })

  // ports ResponseTest::test_props_can_be_added_using_the_with_method
  // (the `ProvidesInertiaProperties` argument has no equivalent in our API and is omitted)
  it('props can be added using the with method', async () => {
    const response = await visit(
      '/user/123',
      (context) => context.render('User/Edit', {}).with({ foo: 'bar', baz: 'qux' }).with({ quux: 'corge' }),
      { version: '123' },
    )
    const page = pageOf(response)

    expect(page.props.foo).toBe('bar')
    expect(page.props.baz).toBe('qux')
    expect(page.props.quux).toBe('corge')
  })

  // ports ResponseTest::test_once_props_are_always_resolved_on_initial_page_load
  it('once props are always resolved on initial page load', async () => {
    const response = await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar') })
    const page = pageOf(response)

    expect(page.component).toBe('User/Edit')
    expect(page.props.foo).toBe('bar')
    expect(page.url).toBe('/user/123')
    expect(page.version).toBe('123')
    expect(page).not.toHaveProperty('clearHistory')
    expect(page).not.toHaveProperty('encryptHistory')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
    expect(response.text).toBe(
      directive(
        '{"component":"User\\/Edit","props":{"errors":{},"foo":"bar"},"url":"\\/user\\/123","version":"123","sharedProps":["errors"],"onceProps":{"foo":{"prop":"foo","expiresAt":null}}}',
      ),
    )
  })

  // ports ResponseTest::test_fresh_once_props_are_included_on_initial_page_load
  it('fresh once props are included on initial page load', async () => {
    const page = pageOf(await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar').fresh() }))

    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_resolved_with_a_custom_key_and_ttl_value
  it('once props are resolved with a custom key and ttl value', async () => {
    const until = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000)
    const page = pageOf(
      await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar').as('baz').until(until) }, { headers: inertia }),
    )

    expect(page.component).toBe('User/Edit')
    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ baz: { prop: 'foo', expiresAt: until.getTime() } })
  })

  // ports ResponseTest::test_once_props_are_not_resolved_on_subsequent_requests_when_they_are_in_the_once_props_header
  it('once props are not resolved on subsequent requests when they are in the once props header', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar') }, {
        headers: { ...inertia, 'X-Inertia-Except-Once-Props': 'foo' },
      }),
    )

    expect(page.props).not.toHaveProperty('foo')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_resolved_on_subsequent_requests_when_the_once_props_header_is_missing
  it('once props are resolved on subsequent requests when the once props header is missing', async () => {
    const page = pageOf(await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar') }, { headers: inertia }))

    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_resolved_on_subsequent_requests_when_they_are_not_in_the_once_props_header
  it('once props are resolved on subsequent requests when they are not in the once props header', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar') }, {
        headers: { ...inertia, 'X-Inertia-Except-Once-Props': 'baz' },
      }),
    )

    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_resolved_on_partial_requests_without_only_or_except
  it('once props are resolved on partial requests without only or except', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar') }, {
        headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'foo', 'X-Inertia-Except-Once-Props': 'foo' }),
      }),
    )

    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_resolved_on_partial_requests_when_included_in_only_headers
  it('once props are resolved on partial requests when included in only headers', async () => {
    const page = pageOf(
      await render(
        '/user/123',
        'User/Edit',
        { foo: Inertia.once(() => 'bar'), baz: Inertia.once(() => 'qux') },
        { headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'foo', 'X-Inertia-Except-Once-Props': 'foo' }) },
      ),
    )

    expect(page.props.foo).toBe('bar')
    expect(page.props).not.toHaveProperty('baz')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_once_props_are_not_resolved_on_partial_requests_when_excluded_in_except_headers
  it('once props are not resolved on partial requests when excluded in except headers', async () => {
    const page = pageOf(
      await render(
        '/user/123',
        'User/Edit',
        { foo: Inertia.once(() => 'bar'), baz: Inertia.once(() => 'qux') },
        { headers: partial('User/Edit', { 'X-Inertia-Partial-Except': 'foo', 'X-Inertia-Except-Once-Props': 'foo' }) },
      ),
    )

    expect(page.props).not.toHaveProperty('foo')
    expect(page.props.baz).toBe('qux')
    expect(page.onceProps).toEqual({ baz: { prop: 'baz', expiresAt: null } })
  })

  // ports ResponseTest::test_fresh_props_are_resolved_even_when_in_except_once_props_header
  it('fresh props are resolved even when in except once props header', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { foo: Inertia.once(() => 'bar').fresh() }, {
        headers: { ...inertia, 'X-Inertia-Except-Once-Props': 'foo' },
      }),
    )

    expect(page.props.foo).toBe('bar')
    expect(page.onceProps).toEqual({ foo: { prop: 'foo', expiresAt: null } })
  })

  // ports ResponseTest::test_fresh_props_are_not_excluded_while_once_props_are_excluded
  it('fresh props are not excluded while once props are excluded', async () => {
    const page = pageOf(
      await render(
        '/user/123',
        'User/Edit',
        { foo: Inertia.once(() => 'bar').fresh(), baz: Inertia.once(() => 'qux') },
        { headers: { ...inertia, 'X-Inertia-Except-Once-Props': 'foo,baz' } },
      ),
    )

    expect(page.props.foo).toBe('bar')
    expect(page.props).not.toHaveProperty('baz')
    expect(page.onceProps).toEqual({
      foo: { prop: 'foo', expiresAt: null },
      baz: { prop: 'baz', expiresAt: null },
    })
  })

  // ports ResponseTest::test_defer_props_that_are_once_and_already_loaded_are_excluded
  it('defer props that are once and already loaded are excluded', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { defer: Inertia.defer(() => 'value').once() }, {
        headers: { ...inertia, 'X-Inertia-Except-Once-Props': 'defer' },
      }),
    )

    expect(page.props).not.toHaveProperty('defer')
    expect(page).not.toHaveProperty('deferredProps')
    expect(page.onceProps).toEqual({ defer: { prop: 'defer', expiresAt: null } })
  })

  // ports ResponseTest::test_defer_props_that_are_once_and_already_loaded_not_excluded_when_explicitly_requested
  it('defer props that are once and already loaded not excluded when explicitly requested', async () => {
    const page = pageOf(
      await render('/user/123', 'User/Edit', { defer: Inertia.defer(() => 'value').once() }, {
        headers: partial('User/Edit', { 'X-Inertia-Partial-Data': 'defer', 'X-Inertia-Except-Once-Props': 'defer' }),
      }),
    )

    expect(page.props.defer).toBe('value')
    expect(page).not.toHaveProperty('deferredProps')
    expect(page.onceProps).toEqual({ defer: { prop: 'defer', expiresAt: null } })
  })

  // ports ResponseTest::test_the_page_url_doesnt_double_up
  // Laravel's sub-directory install (SCRIPT_NAME) maps to an Express app mounted under a path.
  it("the page url doesn't double up", async () => {
    const page = pageOf(
      await visit('/subpath/product/123', (context) => context.render('Product/Show'), {
        mount: '/subpath',
        headers: inertia,
      }),
    )

    expect(page.url).toBe('/subpath/product/123')
  })

  // ports ResponseTest::test_trailing_slashes_in_a_url_are_preserved
  it('trailing slashes in a url are preserved', async () => {
    const page = pageOf(await render('/users/', 'User/Index', {}, { headers: inertia }))

    expect(page.url).toBe('/users/')
  })

  // ports ResponseTest::test_trailing_slashes_in_a_url_with_query_parameters_are_preserved
  it('trailing slashes in a url with query parameters are preserved', async () => {
    const page = pageOf(await render('/users/?page=1&sort=name', 'User/Index', {}, { headers: inertia }))

    expect(page.url).toBe('/users/?page=1&sort=name')
  })

  // ports ResponseTest::test_a_url_without_trailing_slash_is_resolved_correctly
  it('a url without trailing slash is resolved correctly', async () => {
    const page = pageOf(await render('/users', 'User/Index', {}, { headers: inertia }))

    expect(page.url).toBe('/users')
  })

  // ports ResponseTest::test_a_url_without_trailing_slash_and_query_parameters_is_resolved_correctly
  it('a url without trailing slash and query parameters is resolved correctly', async () => {
    const page = pageOf(await render('/users?page=1&sort=name', 'User/Index', {}, { headers: inertia }))

    expect(page.url).toBe('/users?page=1&sort=name')
  })
})
