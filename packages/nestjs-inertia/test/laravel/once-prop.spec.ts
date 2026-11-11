// Ported from inertia-laravel v3.7.0 — tests/OncePropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/OncePropTest.php
import { OnceProp } from '../../src/index.js'

// PHP's string-backed enum `TestBackedEnum::Foo = 'foo-value'`.
enum TestBackedEnum {
  Foo = 'foo-value',
}

describe('OncePropTest (inertia-laravel v3.7.0)', () => {
  // ports OncePropTest::test_can_invoke_with_a_callback
  it('can invoke with a callback', async () => {
    const onceProp = new OnceProp(() => 'A once prop value')

    expect(await onceProp.resolve()).toBe('A once prop value')
  })

  // ports OncePropTest::test_can_set_custom_key
  // (the pure `UnitEnum` case has no TypeScript equivalent and is omitted)
  it('can set custom key', () => {
    const onceProp = new OnceProp(() => 'value')

    const result = onceProp.as('custom-key')
    expect(result).toBe(onceProp)
    expect(onceProp.getKey()).toBe('custom-key')

    onceProp.as(TestBackedEnum.Foo)
    expect(onceProp.getKey()).toBe('foo-value')
  })

  // ports OncePropTest::test_should_not_be_refreshed_by_default
  it('should not be refreshed by default', () => {
    expect(new OnceProp(() => 'value').shouldBeRefreshed()).toBe(false)
  })

  // ports OncePropTest::test_can_forcefully_refresh
  it('can forcefully refresh', () => {
    const onceProp = new OnceProp(() => 'value')
    onceProp.fresh()

    expect(onceProp.shouldBeRefreshed()).toBe(true)
  })

  // ports OncePropTest::test_can_disable_forceful_refresh
  it('can disable forceful refresh', () => {
    const onceProp = new OnceProp(() => 'value')
    onceProp.fresh()
    onceProp.fresh(false)

    expect(onceProp.shouldBeRefreshed()).toBe(false)
  })
})
