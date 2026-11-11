// Ported from inertia-laravel v3.7.0 — tests/PropsResolverTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/PropsResolverTest.php
//
// `makePage($request, $props)` maps to `resolveProps()` (our PropsResolver,
// driven by a fake request); the big-integer cases go through a real response
// (`visit()`), since our big integer handling lives in page serialization.
// `JsonSerializable` / `Arrayable` map to objects with `toJSON()`.
import { Inertia, MergeProp, ScrollProp } from '../../src/index.js'
import { fakeRequest, pageOf, partialRequest, resolveProps, scrollMetadata, visit } from './helpers.js'

const initial = () => fakeRequest()

const onceMeta = (prop: string) => ({ prop, expiresAt: null })

describe('PropsResolverTest (inertia-laravel v3.7.0)', () => {
  // ports PropsResolverTest::test_nested_closure_is_resolved
  it('nested closure is resolved', async () => {
    const page = await resolveProps(initial(), { auth: () => ({ user: 'Jonathan' }) })

    expect(page.props.auth.user).toBe('Jonathan')
  })

  // ports PropsResolverTest::test_nested_closure_inside_array_is_resolved
  it('nested closure inside array is resolved', async () => {
    const page = await resolveProps(initial(), { auth: { user: () => 'Jonathan' } })

    expect(page.props.auth.user).toBe('Jonathan')
  })

  // ports PropsResolverTest::test_nested_always_prop_is_resolved
  it('nested always prop is resolved', async () => {
    const page = await resolveProps(initial(), { auth: { user: Inertia.always(() => 'Jonathan') } })

    expect(page.props.auth.user).toBe('Jonathan')
  })

  // ports PropsResolverTest::test_nested_merge_prop_is_resolved
  it('nested merge prop is resolved', async () => {
    const page = await resolveProps(initial(), { feed: { posts: new MergeProp([{ id: 1 }]) } })

    expect(page.props.feed.posts).toEqual([{ id: 1 }])
  })

  // ports PropsResolverTest::test_nested_once_prop_is_resolved_on_initial_load
  it('nested once prop is resolved on initial load', async () => {
    const page = await resolveProps(initial(), { config: { locale: Inertia.once(() => 'en') } })

    expect(page.props.config.locale).toBe('en')
  })

  // ports PropsResolverTest::test_nested_optional_prop_is_excluded_from_initial_load
  it('nested optional prop is excluded from initial load', async () => {
    let resolved = false
    const page = await resolveProps(initial(), {
      auth: {
        user: 'Jonathan',
        permissions: Inertia.optional(() => {
          resolved = true
          return ['admin']
        }),
      },
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('permissions')
    expect(resolved).toBe(false)
  })

  // ports PropsResolverTest::test_nested_defer_prop_is_excluded_from_initial_load
  it('nested defer prop is excluded from initial load', async () => {
    let resolved = false
    const page = await resolveProps(initial(), {
      auth: {
        user: 'Jonathan',
        notifications: Inertia.defer(() => {
          resolved = true
          return []
        }),
      },
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('notifications')
    expect(resolved).toBe(false)
  })

  // ports PropsResolverTest::test_rescued_defer_prop_is_omitted_and_metadata_on_partial_request
  it('rescued defer prop is omitted and metadata on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.notifications'), {
      auth: {
        notifications: Inertia.defer(
          () => {
            throw new Error('Rescue this deferred prop')
          },
          null,
          { rescue: true },
        ),
      },
    })

    expect(page.props.auth).not.toHaveProperty('notifications')
    expect(page.rescuedProps).toEqual(['auth.notifications'])
  })

  // ports PropsResolverTest::test_rescued_defer_prop_is_omitted_when_provides_inertia_property_throws
  // `ProvidesInertiaProperty::toInertiaProperty()` throwing maps to the returned value's `toJSON()` throwing.
  it('rescued defer prop is omitted when provides inertia property throws', async () => {
    const page = await resolveProps(partialRequest('stats'), {
      stats: Inertia.defer(
        () => ({
          toJSON() {
            throw new Error('Failed to resolve stats')
          },
        }),
        null,
        { rescue: true },
      ),
    })

    expect(page.props).not.toHaveProperty('stats')
    expect(page.rescuedProps).toEqual(['stats'])
  })

  // ports PropsResolverTest::test_excluded_props_are_not_resolved_on_initial_load
  it('excluded props are not resolved on initial load', async () => {
    let optionalResolved = false
    let deferResolved = false

    const page = await resolveProps(initial(), {
      name: 'Jonathan',
      permissions: Inertia.optional(() => {
        optionalResolved = true
        return ['admin']
      }),
      notifications: Inertia.defer(() => {
        deferResolved = true
        return ['You have a new follower']
      }),
    })

    expect(page.props.name).toBe('Jonathan')
    expect(page.props).not.toHaveProperty('permissions')
    expect(page.props).not.toHaveProperty('notifications')
    expect(optionalResolved).toBe(false)
    expect(deferResolved).toBe(false)
  })

  // ports PropsResolverTest::test_closure_returning_optional_prop_is_excluded_from_initial_load
  it('closure returning optional prop is excluded from initial load', async () => {
    let resolved = false
    const page = await resolveProps(initial(), {
      auth: () => ({
        user: 'Jonathan',
        permissions: Inertia.optional(() => {
          resolved = true
          return ['admin']
        }),
      }),
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('permissions')
    expect(resolved).toBe(false)
  })

  // ports PropsResolverTest::test_closure_returning_defer_prop_is_excluded_from_initial_load
  it('closure returning defer prop is excluded from initial load', async () => {
    let resolved = false
    const page = await resolveProps(initial(), {
      auth: () => ({
        user: 'Jonathan',
        notifications: Inertia.defer(() => {
          resolved = true
          return []
        }),
      }),
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('notifications')
    expect(resolved).toBe(false)
  })

  // ports PropsResolverTest::test_closure_returning_merge_prop_resolves_with_metadata
  it('closure returning merge prop resolves with metadata', async () => {
    const page = await resolveProps(initial(), { posts: () => new MergeProp([{ id: 1 }]) })

    expect(page.props.posts).toEqual([{ id: 1 }])
    expect(page.mergeProps).toEqual(['posts'])
  })

  // ports PropsResolverTest::test_closure_returning_once_prop_resolves_with_metadata
  it('closure returning once prop resolves with metadata', async () => {
    const page = await resolveProps(initial(), { locale: () => Inertia.once(() => 'en') })

    expect(page.props.locale).toBe('en')
    expect(page.onceProps).toEqual({ locale: onceMeta('locale') })
  })

  // ports PropsResolverTest::test_closure_returning_defer_prop_collects_deferred_and_merge_metadata
  it('closure returning defer prop collects deferred and merge metadata', async () => {
    const page = await resolveProps(initial(), { posts: () => Inertia.defer(() => [{ id: 1 }]).merge() })

    expect(page.props).not.toHaveProperty('posts')
    expect(page.deferredProps).toEqual({ default: ['posts'] })
    expect(page.mergeProps).toEqual(['posts'])
  })

  // ports PropsResolverTest::test_nested_optional_prop_is_included_on_partial_request
  it('nested optional prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.permissions'), {
      auth: { user: 'Jonathan', permissions: Inertia.optional(() => ['admin']) },
    })

    expect(page.props.auth.permissions).toEqual(['admin'])
  })

  // ports PropsResolverTest::test_nested_defer_prop_is_included_on_partial_request
  it('nested defer prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.notifications'), {
      auth: { user: 'Jonathan', notifications: Inertia.defer(() => ['new message']) },
    })

    expect(page.props.auth.notifications).toEqual(['new message'])
  })

  // ports PropsResolverTest::test_nested_always_prop_is_included_on_partial_request
  it('nested always prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.user'), {
      auth: { user: 'Jonathan', errors: Inertia.always(() => ({ name: 'required' })) },
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth.errors).toEqual({ name: 'required' })
  })

  // ports PropsResolverTest::test_top_level_always_prop_is_included_when_not_requested
  it('top level always prop is included when not requested', async () => {
    const page = await resolveProps(partialRequest('other'), {
      other: 'value',
      errors: Inertia.always(() => ({ name: 'required' })),
    })

    expect(page.props.other).toBe('value')
    expect(page.props.errors).toEqual({ name: 'required' })
  })

  // ports PropsResolverTest::test_nested_merge_prop_is_included_on_partial_request
  it('nested merge prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('feed.posts'), { feed: { posts: new MergeProp([{ id: 1 }]) } })

    expect(page.props.feed.posts).toEqual([{ id: 1 }])
  })

  // ports PropsResolverTest::test_nested_prop_is_excluded_via_except_header
  it('nested prop is excluded via except header', async () => {
    const page = await resolveProps(partialRequest('auth', { 'X-Inertia-Partial-Except': 'auth.token' }), {
      auth: { user: 'Jonathan', token: 'secret' },
    })

    expect(page.props.auth.user).toBe('Jonathan')
    expect(page.props.auth).not.toHaveProperty('token')
  })

  // ports PropsResolverTest::test_partial_request_for_parent_resolves_all_nested_prop_types
  it('partial request for parent resolves all nested prop types', async () => {
    const page = await resolveProps(partialRequest('dashboard'), {
      dashboard: {
        stats: 'visible',
        feed: new MergeProp([{ id: 1 }]),
        notifications: Inertia.defer(() => ['msg']),
        settings: Inertia.optional(() => ({ theme: 'dark' })),
        locale: Inertia.once(() => 'en'),
      },
    })

    expect(page.props.dashboard.stats).toBe('visible')
    expect(page.props.dashboard.feed).toEqual([{ id: 1 }])
    expect(page.props.dashboard.notifications).toEqual(['msg'])
    expect(page.props.dashboard.settings).toEqual({ theme: 'dark' })
    expect(page.props.dashboard.locale).toBe('en')
    expect(page.mergeProps).toEqual(['dashboard.feed'])
    expect(page.onceProps).toEqual({ 'dashboard.locale': onceMeta('dashboard.locale') })
    expect(page).not.toHaveProperty('deferredProps')
  })

  // ports PropsResolverTest::test_nested_defer_prop_metadata_is_collected
  it('nested defer prop metadata is collected', async () => {
    const page = await resolveProps(initial(), { auth: { user: 'Jonathan', notifications: Inertia.defer(() => []) } })

    expect(page.deferredProps).toEqual({ default: ['auth.notifications'] })
  })

  // ports PropsResolverTest::test_nested_defer_prop_metadata_preserves_group
  it('nested defer prop metadata preserves group', async () => {
    const page = await resolveProps(initial(), {
      auth: {
        notifications: Inertia.defer(() => [], 'sidebar'),
        messages: Inertia.defer(() => [], 'sidebar'),
      },
    })

    expect(page.deferredProps).toEqual({ sidebar: ['auth.notifications', 'auth.messages'] })
  })

  // ports PropsResolverTest::test_closure_returning_defer_prop_metadata_is_collected
  it('closure returning defer prop metadata is collected', async () => {
    const page = await resolveProps(initial(), {
      auth: () => ({ user: 'Jonathan', notifications: Inertia.defer(() => [], 'alerts') }),
    })

    expect(page.deferredProps).toEqual({ alerts: ['auth.notifications'] })
  })

  // ports PropsResolverTest::test_nested_merge_prop_metadata_is_collected
  it('nested merge prop metadata is collected', async () => {
    const page = await resolveProps(initial(), { feed: { posts: new MergeProp([{ id: 1 }]) } })

    expect(page.mergeProps).toEqual(['feed.posts'])
  })

  // ports PropsResolverTest::test_nested_prepend_merge_prop_metadata_is_collected
  it('nested prepend merge prop metadata is collected', async () => {
    const page = await resolveProps(initial(), { feed: { posts: new MergeProp([{ id: 1 }]).prepend() } })

    expect(page.prependProps).toEqual(['feed.posts'])
  })

  // ports PropsResolverTest::test_nested_deep_merge_prop_metadata_is_collected
  it('nested deep merge prop metadata is collected', async () => {
    const page = await resolveProps(initial(), { settings: { preferences: new MergeProp({ theme: 'dark' }).deepMerge() } })

    expect(page.deepMergeProps).toEqual(['settings.preferences'])
  })

  // ports PropsResolverTest::test_nested_merge_prop_with_nested_path_metadata_is_collected
  it('nested merge prop with nested path metadata is collected', async () => {
    const page = await resolveProps(initial(), {
      feed: { posts: new MergeProp({ data: [{ id: 1 }] }).append('data') },
    })

    expect(page.mergeProps).toEqual(['feed.posts.data'])
  })

  // ports PropsResolverTest::test_nested_merge_prop_with_match_on_metadata_is_collected
  it('nested merge prop with match on metadata is collected', async () => {
    const page = await resolveProps(initial(), {
      feed: { posts: new MergeProp([{ id: 1 }]).matchOn('id').deepMerge() },
    })

    expect(page.deepMergeProps).toEqual(['feed.posts'])
    expect(page.matchPropsOn).toEqual(['feed.posts.id'])
  })

  // ports PropsResolverTest::test_nested_defer_with_merge_metadata_is_collected
  it('nested defer with merge metadata is collected', async () => {
    const page = await resolveProps(initial(), { feed: { posts: Inertia.defer(() => [{ id: 1 }]).merge() } })

    expect(page.deferredProps).toEqual({ default: ['feed.posts'] })
    expect(page.mergeProps).toEqual(['feed.posts'])
  })

  // ports PropsResolverTest::test_nested_merge_metadata_is_collected_on_exact_partial_request
  it('nested merge metadata is collected on exact partial request', async () => {
    const page = await resolveProps(partialRequest('feed.posts'), { feed: { posts: new MergeProp([{ id: 1 }]) } })

    expect(page.props.feed.posts).toEqual([{ id: 1 }])
    expect(page.mergeProps).toEqual(['feed.posts'])
  })

  // ports PropsResolverTest::test_nested_merge_metadata_is_collected_when_parent_is_requested
  it('nested merge metadata is collected when parent is requested', async () => {
    const page = await resolveProps(partialRequest('feed'), { feed: { posts: new MergeProp([{ id: 1 }]) } })

    expect(page.props.feed.posts).toEqual([{ id: 1 }])
    expect(page.mergeProps).toEqual(['feed.posts'])
  })

  // ports PropsResolverTest::test_nested_merge_prop_metadata_is_suppressed_by_reset_header
  it('nested merge prop metadata is suppressed by reset header', async () => {
    const page = await resolveProps(partialRequest('feed.posts', { 'X-Inertia-Reset': 'feed.posts' }), {
      feed: { posts: new MergeProp([{ id: 1 }]) },
    })

    expect(page.props.feed.posts).toEqual([{ id: 1 }])
    expect(page).not.toHaveProperty('mergeProps')
  })

  // ports PropsResolverTest::test_nested_once_prop_metadata_is_collected
  it('nested once prop metadata is collected', async () => {
    const page = await resolveProps(initial(), { config: { locale: Inertia.once(() => 'en') } })

    expect(page.onceProps).toEqual({ 'config.locale': onceMeta('config.locale') })
  })

  // ports PropsResolverTest::test_nested_once_prop_with_custom_key_metadata_is_collected
  it('nested once prop with custom key metadata is collected', async () => {
    const page = await resolveProps(initial(), { config: { locale: Inertia.once(() => 'en').as('app-locale') } })

    expect(page.onceProps).toEqual({ 'app-locale': onceMeta('config.locale') })
  })

  // ports PropsResolverTest::test_nested_once_prop_is_excluded_when_already_loaded
  it('nested once prop is excluded when already loaded', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia': 'true', 'X-Inertia-Except-Once-Props': 'config.locale' }), {
      config: { locale: Inertia.once(() => 'en'), timezone: 'UTC' },
    })

    expect(page.props.config.timezone).toBe('UTC')
    expect(page.props.config).not.toHaveProperty('locale')
    expect(page.onceProps).toEqual({ 'config.locale': onceMeta('config.locale') })
  })

  // ports PropsResolverTest::test_nested_once_metadata_is_collected_on_exact_partial_request
  it('nested once metadata is collected on exact partial request', async () => {
    const page = await resolveProps(partialRequest('config.locale'), { config: { locale: Inertia.once(() => 'en') } })

    expect(page.props.config.locale).toBe('en')
    expect(page.onceProps).toEqual({ 'config.locale': onceMeta('config.locale') })
  })

  // ports PropsResolverTest::test_nested_once_metadata_is_collected_when_parent_is_requested
  it('nested once metadata is collected when parent is requested', async () => {
    const page = await resolveProps(partialRequest('config'), { config: { locale: Inertia.once(() => 'en') } })

    expect(page.props.config.locale).toBe('en')
    expect(page.onceProps).toEqual({ 'config.locale': onceMeta('config.locale') })
  })

  // ports PropsResolverTest::test_nested_scroll_prop_metadata_is_collected
  it('nested scroll prop metadata is collected', async () => {
    const page = await resolveProps(initial(), {
      feed: { posts: new ScrollProp({ data: [{ id: 1 }] }, 'data', scrollMetadata()) },
    })

    expect(page.scrollProps).toEqual({
      'feed.posts': { pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1, reset: false },
    })
  })

  // ports PropsResolverTest::test_nested_deferred_scroll_prop_is_excluded_from_initial_load
  it('nested deferred scroll prop is excluded from initial load', async () => {
    const page = await resolveProps(initial(), {
      feed: { posts: new ScrollProp({ data: [{ id: 1 }] }, 'data', scrollMetadata()).defer() },
    })

    expect(page.props.feed ?? {}).not.toHaveProperty('posts')
    expect(page.deferredProps).toEqual({ default: ['feed.posts'] })
  })

  // ports PropsResolverTest::test_nested_scroll_prop_is_included_on_partial_request
  it('nested scroll prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('feed.posts'), {
      feed: { posts: new ScrollProp({ data: [{ id: 1 }] }, 'data', scrollMetadata()) },
    })

    expect(page.props.feed.posts).toEqual({ data: [{ id: 1 }] })
    expect(page.scrollProps).toEqual({
      'feed.posts': { pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1, reset: false },
    })
  })

  // ports PropsResolverTest::test_nested_scroll_prop_reset_flag_is_set_by_reset_header
  it('nested scroll prop reset flag is set by reset header', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia-Reset': 'feed.posts' }), {
      feed: { posts: new ScrollProp({ data: [{ id: 1 }] }, 'data', scrollMetadata()) },
    })

    expect(page.scrollProps!['feed.posts'].reset).toBe(true)
  })

  // ports PropsResolverTest::test_nested_defer_once_prop_suppresses_deferred_metadata_when_already_loaded
  it('nested defer once prop suppresses deferred metadata when already loaded', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia-Except-Once-Props': 'feed.posts' }), {
      feed: { posts: Inertia.defer(() => []).once() },
    })

    expect(page).not.toHaveProperty('deferredProps')
  })

  // ports PropsResolverTest::test_nested_defer_once_prop_includes_deferred_metadata_on_first_load
  it('nested defer once prop includes deferred metadata on first load', async () => {
    const page = await resolveProps(initial(), { feed: { posts: Inertia.defer(() => []).once() } })

    expect(page.deferredProps).toEqual({ default: ['feed.posts'] })
    expect(page.onceProps).toEqual({ 'feed.posts': onceMeta('feed.posts') })
  })

  // ports PropsResolverTest::test_nested_props_on_non_partial_inertia_request_behave_like_initial_load
  it('nested props on non partial inertia request behave like initial load', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia': 'true' }), {
      dashboard: {
        stats: 'visible',
        feed: new MergeProp([{ id: 1 }]),
        notifications: Inertia.defer(() => []),
        settings: Inertia.optional(() => []),
      },
    })

    expect(page.props.dashboard.stats).toBe('visible')
    expect(page.props.dashboard.feed).toEqual([{ id: 1 }])
    expect(page.props.dashboard).not.toHaveProperty('notifications')
    expect(page.props.dashboard).not.toHaveProperty('settings')
    expect(page.mergeProps).toEqual(['dashboard.feed'])
    expect(page.deferredProps).toEqual({ default: ['dashboard.notifications'] })
  })

  // ports PropsResolverTest::test_except_header_suppresses_nested_merge_metadata
  it('except header suppresses nested merge metadata', async () => {
    const page = await resolveProps(
      partialRequest('feed.posts,feed.comments', { 'X-Inertia-Partial-Except': 'feed.posts' }),
      { feed: { posts: new MergeProp([{ id: 1 }]), comments: new MergeProp([{ id: 2 }]) } },
    )

    expect(page.props.feed).not.toHaveProperty('posts')
    expect(page.props.feed.comments).toEqual([{ id: 2 }])
    expect(page.mergeProps).toEqual(['feed.comments'])
  })

  // ports PropsResolverTest::test_except_header_for_parent_suppresses_all_nested_metadata
  it('except header for parent suppresses all nested metadata', async () => {
    const page = await resolveProps(partialRequest('feed,other', { 'X-Inertia-Partial-Except': 'feed' }), {
      feed: { posts: new MergeProp([{ id: 1 }]) },
      other: 'value',
    })

    expect(page.props).not.toHaveProperty('feed')
    expect(page.props.other).toBe('value')
    expect(page).not.toHaveProperty('mergeProps')
  })

  // ports PropsResolverTest::test_deeply_nested_defer_prop_is_excluded_with_metadata
  it('deeply nested defer prop is excluded with metadata', async () => {
    const page = await resolveProps(initial(), {
      app: { auth: { notifications: Inertia.defer(() => [], 'alerts') } },
    })

    expect(page.props.app.auth).not.toHaveProperty('notifications')
    expect(page.deferredProps).toEqual({ alerts: ['app.auth.notifications'] })
  })

  // ports PropsResolverTest::test_deeply_nested_merge_prop_metadata_uses_full_path
  it('deeply nested merge prop metadata uses full path', async () => {
    const page = await resolveProps(initial(), { app: { feed: { posts: new MergeProp([{ id: 1 }]) } } })

    expect(page.mergeProps).toEqual(['app.feed.posts'])
  })

  // ports PropsResolverTest::test_deeply_nested_optional_prop_is_included_on_partial_request
  it('deeply nested optional prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('app.auth.permissions'), {
      app: { auth: { permissions: Inertia.optional(() => ['admin']) } },
    })

    expect(page.props.app.auth.permissions).toEqual(['admin'])
  })

  // ports PropsResolverTest::test_multiple_nested_prop_types_are_handled_together
  it('multiple nested prop types are handled together', async () => {
    const page = await resolveProps(initial(), {
      dashboard: {
        stats: 'visible',
        feed: new MergeProp([{ id: 1 }]),
        notifications: Inertia.defer(() => []),
        settings: Inertia.optional(() => []),
        locale: Inertia.once(() => 'en'),
      },
    })

    expect(page.props.dashboard.stats).toBe('visible')
    expect(page.props.dashboard.feed).toEqual([{ id: 1 }])
    expect(page.props.dashboard.locale).toBe('en')
    expect(page.props.dashboard).not.toHaveProperty('notifications')
    expect(page.props.dashboard).not.toHaveProperty('settings')
    expect(page.mergeProps).toEqual(['dashboard.feed'])
    expect(page.deferredProps).toEqual({ default: ['dashboard.notifications'] })
    expect(page.onceProps).toEqual({ 'dashboard.locale': onceMeta('dashboard.locale') })
  })

  // ports PropsResolverTest::test_deferred_props_at_mixed_depths_collect_correct_metadata
  it('deferred props at mixed depths collect correct metadata', async () => {
    const page = await resolveProps(initial(), {
      foo: Inertia.defer(() => 'bar'),
      nested: { a: 'b', c: Inertia.defer(() => 'd') },
    })

    expect(page.props.nested.a).toBe('b')
    expect(page.props).not.toHaveProperty('foo')
    expect(page.props.nested).not.toHaveProperty('c')
    expect(page.deferredProps).toEqual({ default: ['foo', 'nested.c'] })
  })

  // ports PropsResolverTest::test_deferred_props_at_mixed_depths_resolve_on_partial_request
  it('deferred props at mixed depths resolve on partial request', async () => {
    const page = await resolveProps(partialRequest('foo,nested.c'), {
      foo: Inertia.defer(() => 'bar'),
      nested: { a: 'b', c: Inertia.defer(() => 'd') },
    })

    expect(page.props.foo).toBe('bar')
    expect(page.props.nested.c).toBe('d')
    expect(page.props.nested).not.toHaveProperty('a')
    expect(page).not.toHaveProperty('deferredProps')
  })

  // ports PropsResolverTest::test_dot_notation_prop_merges_into_existing_nested_structure
  it('dot notation prop merges into existing nested structure', async () => {
    const page = await resolveProps(initial(), {
      auth: { user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' } },
      'auth.user.permissions': () => ['edit-posts', 'delete-posts'],
    })

    expect(page.props.auth.user.name).toBe('Jonathan Reinink')
    expect(page.props.auth.user.email).toBe('jonathan@example.com')
    expect(page.props.auth.user.permissions).toEqual(['edit-posts', 'delete-posts'])
    expect(page.props).not.toHaveProperty(['auth.user.permissions'])
  })

  // ports PropsResolverTest::test_dot_notation_prop_merges_when_parent_is_a_closure
  it('dot notation prop merges when parent is a closure', async () => {
    const page = await resolveProps(initial(), {
      auth: () => ({ user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' } }),
      'auth.user.permissions': () => ['edit-posts', 'delete-posts'],
    })

    expect(page.props.auth.user.name).toBe('Jonathan Reinink')
    expect(page.props.auth.user.email).toBe('jonathan@example.com')
    expect(page.props.auth.user.permissions).toEqual(['edit-posts', 'delete-posts'])
  })

  // ports PropsResolverTest::test_dot_notation_optional_prop_is_excluded_from_initial_load
  it('dot notation optional prop is excluded from initial load', async () => {
    const page = await resolveProps(initial(), {
      auth: { user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' } },
      'auth.user.permissions': Inertia.optional(() => ['edit-posts', 'delete-posts']),
    })

    expect(page.props.auth.user.name).toBe('Jonathan Reinink')
    expect(page.props.auth.user.email).toBe('jonathan@example.com')
    expect(page.props.auth.user).not.toHaveProperty('permissions')
    expect(page.props).not.toHaveProperty(['auth.user.permissions'])
  })

  // ports PropsResolverTest::test_dot_notation_optional_prop_is_included_on_partial_request
  it('dot notation optional prop is included on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.user.permissions'), {
      auth: { user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' } },
      'auth.user.permissions': Inertia.optional(() => ['edit-posts', 'delete-posts']),
    })

    expect(page.props.auth.user.permissions).toEqual(['edit-posts', 'delete-posts'])
    expect(page.props).not.toHaveProperty(['auth.user.permissions'])
  })

  // ports PropsResolverTest::test_optional_props_inside_indexed_arrays_are_resolved_on_partial_request
  it('optional props inside indexed arrays are resolved on partial request', async () => {
    const page = await resolveProps(partialRequest('foos'), {
      foos: [
        { name: 'First', bar: Inertia.optional(() => 'expensive-data-1') },
        { name: 'Second', bar: Inertia.optional(() => 'expensive-data-2') },
      ],
    })

    expect(page.props.foos[0].name).toBe('First')
    expect(page.props.foos[0].bar).toBe('expensive-data-1')
    expect(page.props.foos[1].name).toBe('Second')
    expect(page.props.foos[1].bar).toBe('expensive-data-2')
  })

  // ports PropsResolverTest::test_optional_props_inside_indexed_arrays_are_excluded_from_initial_load
  it('optional props inside indexed arrays are excluded from initial load', async () => {
    let resolved = false
    const page = await resolveProps(initial(), {
      foos: [
        {
          name: 'First',
          bar: Inertia.optional(() => {
            resolved = true
            return 'expensive-data'
          }),
        },
      ],
    })

    expect(page.props.foos[0].name).toBe('First')
    expect(page.props.foos[0]).not.toHaveProperty('bar')
    expect(resolved).toBe(false)
  })

  // ports PropsResolverTest::test_deferred_props_inside_closure_are_excluded_from_initial_load
  it('deferred props inside closure are excluded from initial load', async () => {
    let notificationsResolved = false
    let rolesResolved = false

    const page = await resolveProps(initial(), {
      auth: () => ({
        user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' },
        notifications: Inertia.defer(() => {
          notificationsResolved = true
          return ['You have a new follower']
        }),
        roles: Inertia.defer(() => {
          rolesResolved = true
          return ['admin']
        }),
      }),
    })

    expect(page.props.auth.user.name).toBe('Jonathan Reinink')
    expect(page.props.auth).not.toHaveProperty('notifications')
    expect(page.props.auth).not.toHaveProperty('roles')
    expect(page.deferredProps).toEqual({ default: ['auth.notifications', 'auth.roles'] })
    expect(notificationsResolved).toBe(false)
    expect(rolesResolved).toBe(false)
  })

  // ports PropsResolverTest::test_deferred_props_inside_closure_are_resolved_on_partial_request
  it('deferred props inside closure are resolved on partial request', async () => {
    const page = await resolveProps(partialRequest('auth.notifications,auth.roles'), {
      auth: () => ({
        user: { name: 'Jonathan Reinink', email: 'jonathan@example.com' },
        notifications: Inertia.defer(() => ['You have a new follower']),
        roles: Inertia.defer(() => ['admin']),
      }),
    })

    expect(page.props.auth.notifications).toEqual(['You have a new follower'])
    expect(page.props.auth.roles).toEqual(['admin'])
  })

  // ports PropsResolverTest::test_it_descends_into_json_serializable_props
  it('descends into JSON-serializable props', async () => {
    const dto = { toJSON: () => ({ nested: { name: 'John' } }) }
    const page = await resolveProps(initial(), { dto })

    expect(page.props.dto).toEqual({ nested: { name: 'John' } })
  })

  // ports PropsResolverTest::test_prop_types_nested_in_json_serializable_props_are_resolved
  it('prop types nested in JSON-serializable props are resolved', async () => {
    const props = () => ({
      dto: { toJSON: () => ({ thing: Inertia.defer(() => 'deferred value'), plain: 1 }) },
    })

    const page = await resolveProps(initial(), props())

    expect(page.props.dto).toEqual({ plain: 1 })
    expect(page.deferredProps).toEqual({ default: ['dto.thing'] })

    const partial = await resolveProps(partialRequest('dto.thing'), props())

    expect(partial.props.dto.thing).toBe('deferred value')
  })
})

describe('PropsResolverTest — big integers (inertia-laravel v3.7.0)', () => {
  // PHP's native 64-bit ints map to `bigint`; `makePage(..., preserveBigIntegers: true)`
  // maps to `InertiaResponse.preserveBigIntegers()`.
  const BIG = 900719925474099988n
  const marker = { $bigint: '900719925474099988' }

  const render = (props: Record<string, unknown>) =>
    visit('/', (inertia) => inertia.render('TestComponent', props).preserveBigIntegers(), { version: '123' })

  // ports PropsResolverTest::test_big_integers_inside_plain_objects_are_wrapped_when_enabled
  it('big integers inside plain objects are wrapped when enabled', async () => {
    const page = pageOf(await render({ object: { id: BIG }, dto: { toJSON: () => ({ id: BIG }) } }))

    expect(page.props.object.id).toEqual(marker)
    expect(page.props.dto.id).toEqual(marker)
  })

  // ports PropsResolverTest::test_big_integers_inside_arbitrary_objects_are_wrapped_when_enabled
  // (the Laravel `Collection` case has no JS equivalent and is omitted)
  it('big integers inside arbitrary objects are wrapped when enabled', async () => {
    class Money {
      cents = BIG
    }

    const money = new Money()
    const page = pageOf(await render({ money, nested: { money }, wrapped: { money } }))

    expect(page.props.money.cents).toEqual(marker)
    expect(page.props.nested.money.cents).toEqual(marker)
    expect(page.props.wrapped.money.cents).toEqual(marker)
  })

  // ports PropsResolverTest::test_an_object_shared_by_two_props_is_wrapped_in_both
  it('an object shared by two props is wrapped in both', async () => {
    const shared = { id: BIG }
    const page = pageOf(await render({ first: shared, second: shared }))

    expect(page.props.first.id).toEqual(marker)
    expect(page.props.second.id).toEqual(marker)
  })

  // ports PropsResolverTest::test_big_integers_inside_numerically_keyed_objects_are_wrapped_without_changing_the_shape
  it('big integers inside numerically keyed objects are wrapped without changing the shape', async () => {
    const response = await render({ list: { '0': BIG, '1': -BIG }, empty: {} })

    expect(response.text).toContain(
      '"list":{"0":{"$bigint":"900719925474099988"},"1":{"$bigint":"-900719925474099988"}}',
    )
    expect(response.text).toContain('"empty":{}')
  })

  // ports PropsResolverTest::test_big_integers_are_wrapped_when_enabled
  it('big integers are wrapped when enabled', async () => {
    const page = pageOf(
      await render({
        safe: 42,
        boundary: 9007199254740991n,
        negativeBoundary: -9007199254740991n,
        big: BIG,
        negative: -BIG,
        nested: { deep: [BIG, 2] },
      }),
    )

    expect(page.props.safe).toBe(42)
    expect(page.props.boundary).toBe(9007199254740991)
    expect(page.props.negativeBoundary).toBe(-9007199254740991)
    expect(page.props.big).toEqual(marker)
    expect(page.props.negative).toEqual({ $bigint: '-900719925474099988' })
    expect(page.props.nested.deep[0]).toEqual(marker)
    expect(page.props.nested.deep[1]).toBe(2)
  })
})
