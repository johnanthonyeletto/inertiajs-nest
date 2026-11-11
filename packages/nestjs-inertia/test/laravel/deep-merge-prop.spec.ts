// Ported from inertia-laravel v3.7.0 — tests/DeepMergePropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/DeepMergePropTest.php
import { MergeProp } from '../../src/index.js'

describe('DeepMergePropTest (inertia-laravel v3.7.0)', () => {
  // ports DeepMergePropTest::test_can_invoke_with_a_callback
  it('can invoke with a callback', async () => {
    const mergeProp = new MergeProp(() => 'A merge prop value').deepMerge()

    expect(await mergeProp.resolve()).toBe('A merge prop value')
  })

  // ports DeepMergePropTest::test_can_invoke_with_a_non_callback
  it('can invoke with a non callback', async () => {
    const mergeProp = new MergeProp({ key: 'value' }).deepMerge()

    expect(await mergeProp.resolve()).toEqual({ key: 'value' })
  })

  // ports DeepMergePropTest::test_can_use_single_string_as_key_to_match_on
  it('can use single string as key to match on', () => {
    const mergeProp = new MergeProp({ key: 'value' }).matchOn('key')

    expect(mergeProp.matchesOn()).toEqual(['key'])
  })

  // ports DeepMergePropTest::test_can_use_an_array_of_strings_as_keys_to_match_on
  it('can use an array of strings as keys to match on', () => {
    const mergeProp = new MergeProp({ key: 'value' }).matchOn(['key', 'anotherKey'])

    expect(mergeProp.matchesOn()).toEqual(['key', 'anotherKey'])
  })
})
