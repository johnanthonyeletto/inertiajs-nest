// Ported from inertia-laravel v3.7.0 — tests/HistoryTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.7.0/tests/HistoryTest.php
//
// `Inertia::encryptHistory()/clearHistory()/preserveFragment()` map to the same
// methods on `InertiaContext`; `EncryptHistoryMiddleware` maps to `@EncryptHistory()`;
// the global `inertia.history.encrypt` config maps to the `encryptHistory` option.
import { EncryptHistory } from '../../src/index.js'
import { closeApps, createApp, exampleMiddleware, inertiaHeaders, route, type RouteDefinition } from './helpers.js'

afterEach(closeApps)

const app = (routes: RouteDefinition[], config = {}) => createApp({ middleware: exampleMiddleware(), routes, config })

describe('HistoryTest (inertia-laravel v3.7.0)', () => {
  // ports HistoryTest::test_the_history_is_not_encrypted_or_cleared_by_default
  it('the history is not encrypted or cleared by default', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).not.toHaveProperty('encryptHistory')
    expect(response.body).not.toHaveProperty('clearHistory')
  })

  // ports HistoryTest::test_the_history_can_be_encrypted
  it('the history can be encrypted', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.encryptHistory().render('User/Edit'))])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', encryptHistory: true })
  })

  // ports HistoryTest::test_the_history_can_be_encrypted_via_middleware
  it('the history can be encrypted via middleware', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.render('User/Edit'), [EncryptHistory()])])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', encryptHistory: true })
  })

  // ports HistoryTest::test_the_history_can_be_encrypted_globally
  it('the history can be encrypted globally', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))], { encryptHistory: true })

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', encryptHistory: true })
  })

  // ports HistoryTest::test_the_history_can_be_encrypted_globally_and_overridden
  it('the history can be encrypted globally and overridden', async () => {
    const { http } = await app(
      [route('GET', '/', ({ inertia }) => inertia.encryptHistory(false).render('User/Edit'))],
      { encryptHistory: true },
    )

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).not.toHaveProperty('encryptHistory')
  })

  // ports HistoryTest::test_the_history_can_be_cleared
  it('the history can be cleared', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.clearHistory().render('User/Edit'))])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ component: 'User/Edit', clearHistory: true })
  })

  // ports HistoryTest::test_the_history_can_be_cleared_when_redirecting
  // `followingRedirects()` re-issues a plain GET (no `X-Inertia`), hence the HTML assertion.
  it('the history can be cleared when redirecting', async () => {
    const { http } = await app([
      route('GET', '/', ({ inertia }) => inertia.clearHistory().redirect('/users')),
      route('GET', '/users', ({ inertia }) => inertia.render('User/Edit')),
    ])

    const redirect = await http().get('/').set(inertiaHeaders)
    expect(redirect.status).toBe(302)

    const response = await http().get(redirect.headers.location).expect(200)

    expect(response.text).toBe(
      '<script data-page="app" type="application/json">{"component":"User\\/Edit","props":{"errors":{}},"url":"\\/users","version":"","sharedProps":["errors"],"clearHistory":true}</script><div id="app"></div>',
    )
  })

  // ports HistoryTest::test_the_fragment_is_not_preserved_by_default
  it('the fragment is not preserved by default', async () => {
    const { http } = await app([route('GET', '/', ({ inertia }) => inertia.render('User/Edit'))])

    const response = await http().get('/').set(inertiaHeaders).expect(200)

    expect(response.body).not.toHaveProperty('preserveFragment')
  })

  // ports HistoryTest::test_the_fragment_can_be_preserved_via_inertia_facade
  it('the fragment can be preserved via inertia facade', async () => {
    const { http } = await app([
      route('GET', '/', ({ inertia }) => inertia.preserveFragment().redirect('/users')),
      route('GET', '/users', ({ inertia }) => inertia.render('User/Edit')),
    ])

    await http().get('/')

    const response = await http().get('/users').set(inertiaHeaders).expect(200)

    expect(response.body).toMatchObject({ preserveFragment: true })
  })
})
