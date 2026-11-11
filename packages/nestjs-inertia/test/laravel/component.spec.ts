// Ported from inertia-laravel v3.7.0 — tests/ComponentTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/ComponentTest.php
//
// Only the cases about the page-object script (escaping and the root element id)
// translate; the rest exercise Blade components and SSR dispatching. Laravel's
// `<x-inertia::app />` maps to the `body` our root view receives.
import { visit } from './helpers.js'

describe('ComponentTest (inertia-laravel v3.7.0)', () => {
  // ports ComponentTest::test_app_component_escapes_html_tags_in_the_page_data
  // Laravel emits `<`; we emit `<`. JSON unicode escapes are case-insensitive.
  it('app component escapes html tags in the page data', async () => {
    const response = await visit('/test', (inertia) => inertia.render('Foo/Bar', { foo: '</script><!--<script>' }))
    const rendered = response.text

    expect(rendered.toLowerCase()).toContain('\\u003c\\/script\\u003e\\u003c!--\\u003cscript\\u003e')
    expect(rendered).not.toContain('<!--')
    expect(rendered.split('</script>')).toHaveLength(2)
  })

  // ports ComponentTest::test_app_component_accepts_custom_id
  // `<x-inertia::app id="custom" />` maps to the `rootElementId` option.
  it('app component accepts custom id', async () => {
    const response = await visit('/test', (inertia) => inertia.render('Foo/Bar', { foo: 'bar' }), {
      config: { rootElementId: 'custom' },
    })

    expect(response.text).toContain('<div id="custom"></div>')
    expect(response.text).toContain('data-page="custom"')
  })
})
