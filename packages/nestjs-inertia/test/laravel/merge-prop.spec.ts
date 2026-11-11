// Ported from inertia-laravel v3.7.0 — tests/MergePropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/MergePropTest.php
import { MergeProp } from '../../src/index.js'

function expectMergeState(
  prop: MergeProp,
  state: { appendsAtRoot: boolean; prependsAtRoot: boolean; append: string[]; prepend: string[]; matchOn: string[] },
) {
  expect(prop.appendsAtRoot()).toBe(state.appendsAtRoot)
  expect(prop.prependsAtRoot()).toBe(state.prependsAtRoot)
  expect(prop.appendsAtPaths()).toEqual(state.append)
  expect(prop.prependsAtPaths()).toEqual(state.prepend)
  expect(prop.matchesOn()).toEqual(state.matchOn)
}

const nested = { appendsAtRoot: false, prependsAtRoot: false }

describe('MergePropTest (inertia-laravel v3.7.0)', () => {
  // ports MergePropTest::test_can_invoke_with_a_callback
  it('can invoke with a callback', async () => {
    expect(await new MergeProp(() => 'A merge prop value').resolve()).toBe('A merge prop value')
  })

  // ports MergePropTest::test_can_invoke_with_a_non_callback
  it('can invoke with a non callback', async () => {
    expect(await new MergeProp({ key: 'value' }).resolve()).toEqual({ key: 'value' })
  })

  // ports MergePropTest::test_appends_by_default
  it('appends by default', () => {
    expectMergeState(new MergeProp([]), { appendsAtRoot: true, prependsAtRoot: false, append: [], prepend: [], matchOn: [] })
  })

  // ports MergePropTest::test_prepends
  it('prepends', () => {
    expectMergeState(new MergeProp([]).prepend(), {
      appendsAtRoot: false,
      prependsAtRoot: true,
      append: [],
      prepend: [],
      matchOn: [],
    })
  })

  // ports MergePropTest::test_appends_with_nested_merge_paths
  it('appends with nested merge paths', () => {
    expectMergeState(new MergeProp([]).append('data'), { ...nested, append: ['data'], prepend: [], matchOn: [] })
  })

  // ports MergePropTest::test_appends_with_nested_merge_paths_and_match_on
  it('appends with nested merge paths and match on', () => {
    expectMergeState(new MergeProp([]).append('data', 'id'), {
      ...nested,
      append: ['data'],
      prepend: [],
      matchOn: ['data.id'],
    })
  })

  // ports MergePropTest::test_prepends_with_nested_merge_paths
  it('prepends with nested merge paths', () => {
    expectMergeState(new MergeProp([]).prepend('data'), { ...nested, append: [], prepend: ['data'], matchOn: [] })
  })

  // ports MergePropTest::test_prepends_with_nested_merge_paths_and_match_on
  it('prepends with nested merge paths and match on', () => {
    expectMergeState(new MergeProp([]).prepend('data', 'id'), {
      ...nested,
      append: [],
      prepend: ['data'],
      matchOn: ['data.id'],
    })
  })

  // ports MergePropTest::test_append_with_nested_merge_paths_as_array
  it('append with nested merge paths as array', () => {
    expectMergeState(new MergeProp([]).append(['data', 'items']), {
      ...nested,
      append: ['data', 'items'],
      prepend: [],
      matchOn: [],
    })
  })

  // ports MergePropTest::test_append_with_nested_merge_paths_and_match_on_as_array
  it('append with nested merge paths and match on as array', () => {
    expectMergeState(new MergeProp([]).append({ data: 'id', items: 'uid' }), {
      ...nested,
      append: ['data', 'items'],
      prepend: [],
      matchOn: ['data.id', 'items.uid'],
    })
  })

  // ports MergePropTest::test_prepend_with_nested_merge_paths_as_array
  it('prepend with nested merge paths as array', () => {
    expectMergeState(new MergeProp([]).prepend(['data', 'items']), {
      ...nested,
      append: [],
      prepend: ['data', 'items'],
      matchOn: [],
    })
  })

  // ports MergePropTest::test_prepend_with_nested_merge_paths_and_match_on_as_array
  it('prepend with nested merge paths and match on as array', () => {
    expectMergeState(new MergeProp([]).prepend({ data: 'id', items: 'uid' }), {
      ...nested,
      append: [],
      prepend: ['data', 'items'],
      matchOn: ['data.id', 'items.uid'],
    })
  })

  // ports MergePropTest::test_mix_of_append_and_prepend_with_nested_merge_paths_and_match_on_as_array
  // PHP's mixed list/map array `['items' => 'uid', 'posts']` has no single JS equivalent,
  // so it is expressed as an object call followed by a string call, in the same order.
  it('mix of append and prepend with nested merge paths and match on as array', () => {
    const mergeProp = new MergeProp([])
      .append('data')
      .append('users', 'id')
      .append({ items: 'uid' })
      .append('posts')
      .prepend('categories')
      .prepend('companies', 'id')
      .prepend({ tags: 'name' })
      .prepend('comments')

    expectMergeState(mergeProp, {
      ...nested,
      append: ['data', 'users', 'items', 'posts'],
      prepend: ['categories', 'companies', 'tags', 'comments'],
      matchOn: ['users.id', 'items.uid', 'companies.id', 'tags.name'],
    })
  })

  // ports MergePropTest::test_is_onceable
  it('is onceable', () => {
    const mergeProp = new MergeProp(() => []).once().as('custom-key').until(60)

    expect(mergeProp.shouldResolveOnce()).toBe(true)
    expect(mergeProp.getKey()).toBe('custom-key')
    expect(mergeProp.expiresAt()).not.toBeNull()
  })
})
