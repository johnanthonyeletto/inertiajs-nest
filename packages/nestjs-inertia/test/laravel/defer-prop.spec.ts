// Ported from inertia-laravel v3.7.0 — tests/DeferPropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/DeferPropTest.php
import { DeferProp } from '../../src/index.js'

describe('DeferPropTest (inertia-laravel v3.7.0)', () => {
  // ports DeferPropTest::test_can_invoke
  it('can invoke', async () => {
    const deferProp = new DeferProp(() => 'A deferred value', 'default')

    expect(await deferProp.resolve()).toBe('A deferred value')
    expect(deferProp.group()).toBe('default')
  })

  // ports DeferPropTest::test_can_invoke_and_merge
  it('can invoke and merge', async () => {
    const deferProp = new DeferProp(() => 'A deferred value').merge()

    expect(await deferProp.resolve()).toBe('A deferred value')
  })

  // ports DeferPropTest::test_is_onceable
  it('is onceable', () => {
    const deferProp = new DeferProp(() => 'value').once(true, { as: 'custom-key', until: 60 })

    expect(deferProp.shouldResolveOnce()).toBe(true)
    expect(deferProp.getKey()).toBe('custom-key')
    expect(deferProp.expiresAt()).not.toBeNull()
  })

  // ports DeferPropTest::test_can_be_marked_as_rescuable
  it('can be marked as rescuable', () => {
    const deferProp = new DeferProp(() => 'value', null, true)

    expect(deferProp.shouldRescue()).toBe(true)
  })
})
