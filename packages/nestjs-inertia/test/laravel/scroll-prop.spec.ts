// Ported from inertia-laravel v3.7.0 — tests/ScrollPropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ScrollPropTest.php
//
// Laravel's `User::query()->paginate(15)` is replaced by a minimal length-aware
// paginator implementing our `ProvidesScrollMetadata` contract (`toScrollMetadata()`).
import { type ProvidesScrollMetadata, ScrollProp } from '../../src/index.js'
import { pageOf, visit } from './helpers.js'

class FakePaginator implements ProvidesScrollMetadata {
  constructor(
    private readonly items: unknown[],
    private readonly perPage: number,
    private readonly page = 1,
  ) {}

  private get lastPage() {
    return Math.max(1, Math.ceil(this.items.length / this.perPage))
  }

  toJSON() {
    return { data: this.items.slice((this.page - 1) * this.perPage, this.page * this.perPage), current_page: this.page }
  }

  toScrollMetadata() {
    return {
      pageName: 'page',
      previousPage: this.page > 1 ? this.page - 1 : null,
      nextPage: this.page < this.lastPage ? this.page + 1 : null,
      currentPage: this.page,
    }
  }
}

const users = Array.from({ length: 40 }, (_, index) => ({ id: index + 1 }))
const paginateUsers = () => new FakePaginator(users, 15)

describe('ScrollPropTest (inertia-laravel v3.7.0)', () => {
  // ports ScrollPropTest::test_resolves_meta_data
  it('resolves meta data', async () => {
    const scrollProp = new ScrollProp(paginateUsers())

    expect(await scrollProp.metadata()).toEqual({ pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1 })
  })

  // ports ScrollPropTest::test_resolves_custom_meta_data
  it('resolves custom meta data', async () => {
    const customMetaCallback = () => ({ pageName: 'usersPage', previousPage: 10, nextPage: 12, currentPage: 11 })
    const scrollProp = new ScrollProp(paginateUsers(), 'data', customMetaCallback)

    expect(await scrollProp.metadata()).toEqual({ pageName: 'usersPage', previousPage: 10, nextPage: 12, currentPage: 11 })
  })

  // ports ScrollPropTest::test_can_set_the_merge_intent_based_on_the_merge_intent_header
  // Our `configureMergeIntent()` receives the header value instead of reading the global request.
  it('can set the merge intent based on the merge intent header', () => {
    const appendProp = new ScrollProp(paginateUsers()).configureMergeIntent(undefined)
    expect(appendProp.appendsAtPaths()).toContain('data')
    expect(appendProp.prependsAtPaths()).toEqual([])

    const appendWithHeader = new ScrollProp(paginateUsers()).configureMergeIntent('append')
    expect(appendWithHeader.appendsAtPaths()).toContain('data')
    expect(appendWithHeader.prependsAtPaths()).toEqual([])

    const prependProp = new ScrollProp(paginateUsers()).configureMergeIntent('prepend')
    expect(prependProp.prependsAtPaths()).toContain('data')
    expect(prependProp.appendsAtPaths()).toEqual([])

    const customWrapper = new ScrollProp(paginateUsers(), 'items').configureMergeIntent('prepend')
    expect(customWrapper.prependsAtPaths()).toContain('items')
    expect(customWrapper.appendsAtPaths()).toEqual([])
  })

  // ports ScrollPropTest::test_resolves_meta_data_with_callable_provider
  it('resolves meta data with callable provider', async () => {
    const callableMetadata = () => ({ pageName: 'callablePage', previousPage: 5, nextPage: 7, currentPage: 6 })
    const scrollProp = new ScrollProp([], 'data', callableMetadata)

    expect(await scrollProp.metadata()).toEqual({ pageName: 'callablePage', previousPage: 5, nextPage: 7, currentPage: 6 })
  })

  // ports ScrollPropTest::test_scroll_prop_value_is_resolved_only_once
  it('scroll prop value is resolved only once', async () => {
    let callCount = 0
    const scrollProp = new ScrollProp(() => {
      callCount++
      return ['item1', 'item2', 'item3']
    })

    const value1 = await scrollProp.resolve()
    const value2 = await scrollProp.resolve()
    const value3 = await scrollProp.resolve()

    expect(callCount).toBe(1)
    expect(value1).toEqual(value2)
    expect(value2).toEqual(value3)
    expect(value1).toEqual(['item1', 'item2', 'item3'])
  })

  // ports ScrollPropTest::test_deferred_scroll_prop_is_excluded_from_initial_request
  it('deferred scroll prop is excluded from initial request', async () => {
    const response = await visit(
      '/users',
      (inertia) => inertia.render('Users/Index', { users: new ScrollProp(paginateUsers).defer() }),
      { version: '123' },
    )
    const page = pageOf(response)

    expect(page.props).not.toHaveProperty('users')
    expect(page.deferredProps).toEqual({ default: ['users'] })
    expect(page).not.toHaveProperty('scrollProps')
  })

  // ports ScrollPropTest::test_deferred_scroll_prop_is_resolved_on_partial_request
  it('deferred scroll prop is resolved on partial request', async () => {
    const response = await visit(
      '/users',
      (inertia) => inertia.render('Users/Index', { users: new ScrollProp(paginateUsers).defer() }),
      {
        version: '123',
        headers: { 'X-Inertia': 'true', 'X-Inertia-Partial-Component': 'Users/Index', 'X-Inertia-Partial-Data': 'users' },
      },
    )
    const page = pageOf(response)

    expect(page.props).toHaveProperty('users')
    expect(page.props.users.data).toHaveLength(15)
    expect(page).toHaveProperty('scrollProps')
    expect(page.scrollProps!.users.pageName).toBe('page')
    expect(page.mergeProps).toContain('users.data')
  })

  // ports ScrollPropTest::test_deferred_scroll_prop_can_have_custom_group
  it('deferred scroll prop can have custom group', async () => {
    const response = await visit(
      '/users',
      (inertia) => inertia.render('Users/Index', { users: new ScrollProp(paginateUsers).defer('custom-group') }),
      { version: '123' },
    )
    const page = pageOf(response)

    expect(page.props).not.toHaveProperty('users')
    expect(page.deferredProps).toEqual({ 'custom-group': ['users'] })
  })
})
