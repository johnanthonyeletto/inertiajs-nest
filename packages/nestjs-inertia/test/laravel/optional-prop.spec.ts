// Ported from inertia-laravel v3.7.0 — tests/OptionalPropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/OptionalPropTest.php
import { OptionalProp } from '../../src/index.js'

describe('OptionalPropTest (inertia-laravel v3.7.0)', () => {
  // ports OptionalPropTest::test_can_invoke
  it('can invoke', async () => {
    const optionalProp = new OptionalProp(() => 'An optional value')

    expect(await optionalProp.resolve()).toBe('An optional value')
  })

  // ports OptionalPropTest::test_is_onceable
  it('is onceable', () => {
    const optionalProp = new OptionalProp(() => 'value').once().as('custom-key').until(60)

    expect(optionalProp.shouldResolveOnce()).toBe(true)
    expect(optionalProp.getKey()).toBe('custom-key')
    expect(optionalProp.expiresAt()).not.toBeNull()
  })
})
