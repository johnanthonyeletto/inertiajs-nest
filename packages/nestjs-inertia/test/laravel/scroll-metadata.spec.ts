// Ported from inertia-laravel v3.7.0 — tests/ScrollMetadataTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ScrollMetadataTest.php
//
// Laravel's `ScrollMetadata::fromPaginator()` reads Laravel paginators; our
// equivalent is `ScrollProp.metadata()`, which reads any value implementing
// `toScrollMetadata()`. Only the non-paginator case translates.
import { ScrollProp } from '../../src/index.js'

describe('ScrollMetadataTest (inertia-laravel v3.7.0)', () => {
  // ports ScrollMetadataTest::test_throws_exception_if_not_a_paginator
  it('throws exception if not a paginator', async () => {
    await expect(new ScrollProp([]).metadata()).rejects.toThrow(
      'The scroll prop value does not provide scroll metadata.',
    )
  })
})
