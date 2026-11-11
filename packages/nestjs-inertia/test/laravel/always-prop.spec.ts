// Ported from inertia-laravel v3.7.0 — tests/AlwaysPropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/AlwaysPropTest.php
import { AlwaysProp } from '../../src/index.js'

describe('AlwaysPropTest (inertia-laravel v3.7.0)', () => {
  // ports AlwaysPropTest::test_can_invoke
  it('can invoke', async () => {
    const alwaysProp = new AlwaysProp(() => 'An always value')

    expect(await alwaysProp.resolve()).toBe('An always value')
  })

  // ports AlwaysPropTest::test_can_accept_scalar_values
  it('can accept scalar values', async () => {
    const alwaysProp = new AlwaysProp('An always value')

    expect(await alwaysProp.resolve()).toBe('An always value')
  })
})
