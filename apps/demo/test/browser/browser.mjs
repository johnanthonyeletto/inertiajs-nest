/**
 * End-to-end browser checks for every demo page, run against a live server:
 *
 *   pnpm dev               # or: pnpm build && pnpm --filter demo start:ssr & pnpm start
 *   pnpm test:browser      # BASE=http://localhost:3000 by default
 *
 * Creates some data (contacts, notes), so prefer a fresh database (`pnpm --filter demo db:fresh`).
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'
const avatarPath = join(tmpdir(), 'nestjs-inertia-avatar.png')
const bigFilePath = join(tmpdir(), 'nestjs-inertia-big.bin')
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
const problems = []
const results = []

// Browsers log every 4xx/5xx response; those are expected in the error demos.
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type()) && !msg.text().startsWith('Failed to load resource')) {
    problems.push(`[console.${msg.type()}] ${page.url()} :: ${msg.text().slice(0, 300)}`)
  }
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${page.url()} :: ${err.message}`))
writeFileSync(avatarPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
writeFileSync(bigFilePath, Buffer.alloc(3 * 1024 * 1024, 1))
await page.route('https://inertiajs.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>External site</h1>' }))

async function check(name, fn) {
  try {
    await fn()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.split('\n')[0]}`)
  }
}
const expectText = async (text, timeout = 5000) => page.getByText(text, { exact: false }).first().waitFor({ timeout })
const toast = (text) => page.locator('[aria-live="polite"]').getByText(text).waitFor({ timeout: 5000 })
const go = async (path) => {
  await page.goto(BASE + path)
  await page.waitForLoadState('networkidle')
  // Server-rendered markup is visible before React hydrates; interacting
  // earlier (e.g. on a cold dev server) would trigger native form posts.
  await page.waitForFunction(() => {
    const root = document.getElementById('app')
    return !!root && Object.keys(root).some((key) => key.startsWith('__reactContainer$'))
  })
}

// Every sidebar page: once through Inertia navigation, once as a full (SSR) page load.
await check('every page renders via Inertia visits and SSR + hydration', async () => {
  await go('/login')
  await page.click('button:has-text("Sign in")')
  await page.waitForURL(BASE + '/')
  const links = await page.$$eval('aside nav a', (anchors) => anchors.map((a) => a.getAttribute('href')))

  for (const href of links) {
    await page.click(`aside nav a[href="${href}"]`)
    await page.waitForURL((url) => url.pathname === href, { timeout: 10000 })
    await page.locator('main h1').first().waitFor()
  }

  for (const href of links) {
    await go(href)
    if (!(await page.evaluate(() => !!document.querySelector('[data-server-rendered="true"]')))) {
      throw new Error(`${href} was not server-side rendered`)
    }
  }

  await page.click('button:has-text("Sign out")')
  await page.waitForURL(BASE + '/login')
})

await check('login with wrong password shows error', async () => {
  await go('/login')
  await page.fill('#password', 'wrong')
  await page.click('button:has-text("Sign in")')
  await expectText('These credentials do not match our records.')
})
await check('login succeeds with toast', async () => {
  await page.fill('#password', 'secret')
  await page.click('button:has-text("Sign in")')
  await page.waitForURL(BASE + '/')
  await toast('Welcome back, John!')
  await expectText('Favorites')
  await page.locator('main a[href^="/contacts/"]').first().waitFor()
})
await check('contacts search is a debounced partial reload', async () => {
  await go('/contacts')
  const requests = []
  const listener = (req) => { if (req.headers()['x-inertia']) requests.push(req.headers()) }
  page.on('request', listener)
  await page.fill('input[type="search"]', 'ab')
  await page.waitForURL(/search=ab/)
  await page.waitForLoadState('networkidle')
  page.off('request', listener)
  if (requests.length !== 1) throw new Error(`expected 1 request, got ${requests.length}`)
  if (requests[0]['x-inertia-partial-data'] !== 'contacts,filters') throw new Error('not a partial reload: ' + requests[0]['x-inertia-partial-data'])
  if (await page.locator('input[type="search"]').evaluate((el) => document.activeElement !== el)) throw new Error('input lost focus (preserveState)')
})
await check('create contact with avatar upload', async () => {
  await go('/contacts/create')
  await page.waitForSelector('select[name="organizationId"] option:nth-child(3)', { state: 'attached' })
  await page.fill('#firstName', 'Zed')
  await page.fill('#lastName', 'Tester')
  await page.selectOption('select[name="organizationId"]', { index: 2 })
  await page.setInputFiles('input[type="file"]', avatarPath)
  await page.click('button:has-text("Create contact")')
  await page.waitForURL(BASE + '/contacts')
  await toast('Zed Tester was created.')
})
await check('create contact validation errors', async () => {
  await go('/contacts/create')
  await page.fill('#email', 'not-an-email')
  await page.click('button:has-text("Create contact")')
  await expectText('The first name field is required.')
  await expectText('The email field must be a valid email address.')
})
let contactUrl
await check('edit contact: update, note, favorite, delete, restore', async () => {
  await go('/contacts?search=Zed')
  await page.click('main a:has-text("Zed Tester")')
  await page.waitForURL(/\/contacts\/\d+\/edit/)
  contactUrl = page.url()
  if (!(await page.locator('main img[alt="Zed Tester"]').count())) throw new Error('avatar not shown')
  await page.fill('#city', 'Springfield')
  await page.click('button:has-text("Update contact")')
  await toast('Contact updated.')
  await page.fill('textarea[name="body"]', 'Met at the conference.')
  await page.click('button:has-text("Add note")')
  await expectText('Met at the conference.')
  await page.waitForFunction(() => document.querySelector('textarea[name="body"]').value === '', null, { timeout: 3000 })
  const favorite = page.locator('main button[aria-pressed]')
  const pressed = await favorite.getAttribute('aria-pressed')
  await favorite.click()
  await page.waitForFunction((before) => document.querySelector('main button[aria-pressed]').getAttribute('aria-pressed') !== before, pressed, { timeout: 2000 })
  page.once('dialog', (dialog) => dialog.accept())
  await page.click('button:has-text("Delete contact")')
  await expectText('This contact has been deleted.')
  await page.click('button:has-text("Restore")')
  await toast('Contact restored.')
})
await check('links: method buttons + 303 + only', async () => {
  await go('/features/links')
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/features/links') && r.request().method() === method),
      page.click(`main button:has-text("${method.toLowerCase()}")`),
    ])
    const expected = method === 'POST' ? 302 : 303
    if (response.status() !== expected) throw new Error(`${method} -> ${response.status()}`)
    await toast(`${method} request received`)
  }
  const before = await page.locator('main').getByText('Server timestamp').textContent()
  await page.click('text=Increment local counter')
  const [req] = await Promise.all([page.waitForRequest((r) => r.headers()['x-inertia-partial-data'] === 'timestamp'), page.click("text=only: ['timestamp']")])
  await page.waitForLoadState('networkidle')
  if (!(await page.getByText('Local counter: 1').count())) throw new Error('preserveState lost counter')
})
await check('redirects: back, route, external', async () => {
  await go('/features/redirects')
  await page.click('li:has-text("Redirect back") button')
  await toast('Redirected back to the previous page.')
  await page.click('li:has-text("PUT → 303 See Other") button')
  await toast('303 See Other')
  await page.click('li:has-text("Redirect to another page") button')
  await page.waitForURL(BASE + '/features/links')
  await go('/features/redirects')
  await page.click('li:has-text("External redirect") button')
  await page.waitForURL('https://inertiajs.com/')
})
await check('url fragments: 409 redirect + preserveFragment', async () => {
  await go('/features/url-fragments')
  await page.click('text=Server redirect to #server-section')
  await page.waitForURL(BASE + '/features/url-fragments#server-section')
  await go('/features/url-fragments')
  await page.click('text=Redirect preserving #section-3')
  await page.waitForURL(BASE + '/features/url-fragments/preserve-target#section-3')
  await expectText('Redirected from /features/url-fragments/preserve-redirect')
})
await check('history encryption: state is encrypted', async () => {
  await go('/features/history')
  const state = await page.evaluate(() => window.history.state)
  const raw = JSON.stringify(state?.page ?? null)
  if (raw.includes('Sensitive value') || raw.includes('secret-')) throw new Error('page state stored in plaintext')
  await page.click('text=Next visit →')
  await expectText('Visit #1')
  await page.goBack()
  await expectText('Visit #0')
})
await check('instant visit swaps before the response', async () => {
  await go('/features/instant-visits')
  const start = Date.now()
  await page.click('text=Instant visit (2s server)')
  await page.locator('main h1:has-text("Instant visit target")').waitFor({ timeout: 1000 })
  const swapped = Date.now() - start
  await expectText('Signed in as John Doe', 500)
  await expectText('Hello from the server!', 5000)
  await expectText('Bravo')
  if (swapped > 1000) throw new Error('swap took ' + swapped)
})
await check('useForm: nested errors, success, reset', async () => {
  await go('/features/forms/use-form')
  await page.click('button:has-text("Save")')
  await expectText('The company name field is required.')
  await expectText('You must accept the terms.')
  await page.fill('#name', 'Ada')
  await page.fill('#email', 'ada@example.com')
  await page.selectOption('#plan', 'pro')
  await page.fill('[id="company.name"]', 'Analytical Engines')
  await page.check('input[type="checkbox"]')
  await page.click('button:has-text("Save")')
  await toast('Saved Ada (pro) at Analytical Engines.')
  if ((await page.inputValue('#name')) !== '') throw new Error('form not reset')
})
await check('<Form>: errors and success', async () => {
  await go('/features/forms/form-component')
  await page.click('button:has-text("Submit")')
  await expectText('The name field is required.')
  await page.fill('#fc-name', 'Grace')
  await page.fill('#fc-email', 'grace@example.com')
  await page.selectOption('#fc-plan', 'free')
  await page.fill('#fc-company', 'Navy')
  await page.check('input[name="terms"]')
  await page.click('button:has-text("Submit")')
  await toast('<Form> submitted for Grace.')
  await expectText('"name": "Navy"')
})
await check('file uploads: multipart with progress', async () => {
  await go('/features/forms/file-uploads')
  await page.click('button:has-text("Upload")')
  await expectText('The title field is required.')
  await page.fill('#title', 'Docs')
  await page.setInputFiles('#files', [bigFilePath, avatarPath])
  await page.click('button:has-text("Upload")')
  await toast('"Docs": uploaded 2 file(s).')
  await expectText('nestjs-inertia-big.bin')
  await expectText('3.0 MB')
})
await check('validation: error bags', async () => {
  await go('/features/forms/validation')
  await page.click('button:has-text("Submit secondary")')
  await expectText('The company field is required.')
  const errors = await page.locator('pre').first().textContent()
  if (!errors.includes('"secondary"')) throw new Error('errors not in secondary bag: ' + errors)
  if (await page.getByText('The name field is required.').count()) throw new Error('primary form shows secondary errors')
})
await check('precognition: live server validation', async () => {
  await go('/features/forms/precognition')
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().headers()['precognition'] === 'true'),
    (async () => { await page.fill('#username', 'admin'); await page.locator('#username').blur() })(),
  ])
  if (response.status() !== 422) throw new Error('expected 422 got ' + response.status())
  await expectText('This username is already taken.')
  await page.fill('#email', 'johndoe@example.com')
  await page.locator('#email').blur()
  await expectText('This email has already been taken.')
  await page.fill('#username', 'ada_l')
  await page.locator('#username').blur()
  await page.waitForFunction(() => !document.body.innerText.includes('This username is already taken.'))
  await page.fill('#email', 'ada@example.com')
  await page.fill('#password', 'supersecret')
  await page.fill('#passwordConfirmation', 'supersecret')
  const [ok] = await Promise.all([page.waitForResponse((r) => r.request().headers()['precognition'] === 'true'), page.locator('#email').focus().then(() => page.locator('#email').blur())])
  if (ok.status() !== 204) throw new Error('expected 204 got ' + ok.status() + ' ' + (await ok.text()))
  if (ok.headers()['precognition-success'] !== 'true') throw new Error('missing Precognition-Success')
  await page.click('button:has-text("Create account")')
  await toast('Account "ada_l" passed validation!')
})
await check('optimistic update + rollback', async () => {
  await go('/features/forms/optimistic-updates')
  const star = page.locator('main ul li button').first()
  const before = await star.getAttribute('class')
  await star.click()
  await page.waitForTimeout(150)
  const during = await star.getAttribute('class')
  if (before.includes('text-amber-500') === during.includes('text-amber-500')) throw new Error('no optimistic flip')
  await page.waitForLoadState('networkidle')
  await page.check('text=Make the server fail')
  const before2 = await star.getAttribute('class')
  await star.click()
  await page.waitForTimeout(150)
  const during2 = await star.getAttribute('class')
  if (before2.includes('text-amber-500') === during2.includes('text-amber-500')) throw new Error('no optimistic flip (fail)')
  await expectText('Simulated failure', 4000)
  const after2 = await star.getAttribute('class')
  if (before2.includes('text-amber-500') !== after2.includes('text-amber-500')) throw new Error('not rolled back')
})
await check('useHttp: 422 errors and JSON response', async () => {
  await go('/features/forms/use-http')
  await page.click('button:has-text("Send")')
  await expectText('Please tell us your name.')
  await page.fill('#name', 'Ada')
  await page.click('button:has-text("Send")')
  await expectText('Hello, Ada!')
  await page.fill('input[placeholder="Search contacts…"]', 'a')
  await page.locator('main ul li').first().waitFor()
})
await check('partial reloads: only + always', async () => {
  await go('/features/data/partial-reloads')
  const [req, res] = await Promise.all([
    page.waitForRequest((r) => !!r.headers()['x-inertia-partial-data']),
    page.waitForResponse((r) => !!r.request().headers()['x-inertia-partial-data']),
    page.click('text=only randomNumber'),
  ])
  const body = await res.json()
  const keys = Object.keys(body.props).sort().join(',')
  if (keys !== 'errors,randomNumber,serverTime') throw new Error('keys ' + keys)
})
await check('deferred props: groups + rescue + retry', async () => {
  await go('/features/data/deferred-props')
  await expectText('Report value', 1).then(() => { throw new Error('rendered too early') }, () => {})
  await expectText('The report failed to load.', 5000)
  await page.locator('main').getByText('Favorites').waitFor()
  await page.click('button:has-text("Retry")')
  await expectText('Report value', 5000)
})
await check('optional props load on demand', async () => {
  await go('/features/data/optional-props')
  await page.click('text=Load optionalData')
  await expectText('"generatedAt"')
})
await check('merge props: append/prepend/match/deep/reset', async () => {
  await go('/features/data/merge-props')
  const count = (sel) => page.locator(sel).count()
  await page.click('text=Load more notifications')
  await page.waitForFunction(() => document.querySelectorAll('main section:nth-of-type(1) li').length === 2)
  await page.click('text=New activity')
  await page.waitForFunction(() => document.querySelectorAll('main section:nth-of-type(2) li').length === 2)
  await page.click('text=Reload team')
  await page.waitForFunction(() => document.querySelectorAll('main section:nth-of-type(3) li').length === 2)
  await page.click('text=Reload team')
  await page.waitForFunction(() => document.querySelectorAll('main section:nth-of-type(3) li').length === 3)
  await page.click('text=Reset team')
  await page.waitForFunction(() => document.querySelectorAll('main section:nth-of-type(3) li').length === 1)
  await page.click('text=Load older messages')
  await expectText('Message #4')
  await expectText('Message #1')
  await expectText('"loadedPages": 2')
  await page.click('text=Reset conversation')
  await page.waitForFunction(() => !document.body.innerText.includes('Message #4'))
})
await check('infinite scroll loads pages and syncs the URL', async () => {
  await go('/features/data/infinite-scroll')
  const rows = () => page.locator('main .card > div.flex').count()
  if ((await rows()) !== 15) throw new Error('initial rows ' + (await rows()))
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(700) }
  const loaded = await rows()
  if (loaded < 30) throw new Error('rows after scroll ' + loaded)
  if (!/page=\d/.test(page.url())) throw new Error('url not synced: ' + page.url())
  await page.click('main button:has-text("Favorites")')
  await page.waitForURL(/favorites=1/)
  await page.waitForLoadState('networkidle')
  const favRows = await page.locator('main .card > div.flex').count()
  const stars = await page.locator('main .card > div.flex >> text=★').count()
  if (favRows !== stars) throw new Error(`non-favorites after reset ${favRows} vs ${stars}`)
})
await check('once props are remembered across pages', async () => {
  await go('/features/data/once-props')
  const value = async (title) => page.locator(`section:has(h2:text-is("${title}")) .text-3xl`).textContent()
  const first = { once: await value('Inertia.once()'), fresh: await value('.fresh()'), alias: await value(".as('shared-once-key')") }
  const [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith('/once-props/2')), page.click('main a:has-text("Page 2")')])
  await page.waitForURL(BASE + '/features/data/once-props/2')
  await page.waitForLoadState('networkidle')
  const header = req.headers()['x-inertia-except-once-props'] ?? ''
  if (!header.includes('plans') || !header.includes('shared-once-key')) throw new Error('header ' + header)
  const second = { once: await value('Inertia.once()'), fresh: await value('.fresh()'), alias: await value(".as('shared-once-key')") }
  if (first.once !== second.once || first.alias !== second.alias) throw new Error('once prop changed')
})
await check('polling', async () => {
  await go('/features/data/polling')
  await page.waitForTimeout(4600)
  const polls = Number(await page.locator('div:has(> div:text-is("Completed polls")) > div').nth(1).textContent())
  if (polls < 2) throw new Error('polls ' + polls)
  await page.click('main button:has-text("Stop")')
})
await check('when visible', async () => {
  await go('/features/data/when-visible')
  if (await page.getByText('Grace').count()) throw new Error('loaded before visible')
  await page.locator('h2:text-is("Team members")').scrollIntoViewIfNeeded()
  await expectText('Grace', 5000)
  await page.locator('h2:text-is("Favorites")').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => document.querySelectorAll('main section:last-of-type li').length > 0)
})
await check('prefetching: hover prefetch makes the visit instant', async () => {
  await go('/features/prefetching')
  const [prefetch] = await Promise.all([
    page.waitForRequest((r) => r.headers()['purpose'] === 'prefetch' && r.url().endsWith('/pages/1')),
    page.hover('text=Hover (75ms) →'),
  ])
  await page.waitForResponse((r) => r.url().endsWith('/pages/1'))
  const start = Date.now()
  await page.click('text=Hover (75ms) →')
  await page.locator('main h1:has-text("Prefetch target #1")').waitFor()
  if (Date.now() - start > 600) throw new Error('visit was not instant: ' + (Date.now() - start))
  await expectText('isPrefetched: true')
})
await check('remember state restores on back', async () => {
  await go('/features/state/remember')
  await page.fill('textarea', 'remember me')
  await page.fill('#search', 'kept')
  await page.click('text=Navigate away →')
  await page.waitForURL(BASE + '/features/state/flash')
  await page.goBack()
  await page.waitForURL(BASE + '/features/state/remember')
  if ((await page.inputValue('textarea')) !== 'remember me') throw new Error('useRemember not restored')
  if ((await page.inputValue('#search')) !== 'kept') throw new Error('useForm remember not restored')
})
await check('flash: server + client, not re-shown on back', async () => {
  await go('/features/state/flash')
  await page.click('main button:has-text("Warning")')
  await toast('Please double-check your input.')
  await expectText('"highlight"')
  await page.click('text=Client-side flash')
  await toast('Flashed on the client with router.flash()')
  await page.click('aside a[href="/features/links"]')
  await page.waitForURL(BASE + '/features/links')
  await page.waitForTimeout(4200)
  await page.goBack()
  await page.waitForURL(BASE + '/features/state/flash')
  await page.waitForTimeout(400)
  if (await page.locator('[aria-live="polite"] div').count()) throw new Error('flash re-shown from history')
})
await check('shared props', async () => {
  await go('/features/state/shared-props')
  await expectText('Shared via inertia.share() in the controller')
  await expectText('"favoritesCount"')
  await expectText('"controllerShared"')
})
await check('persistent layout keeps state', async () => {
  await go('/features/layouts/persistent')
  await page.waitForTimeout(2200)
  await page.click('main a:has-text("Page 2")')
  await page.waitForURL(BASE + '/features/layouts/persistent/2')
  await expectText('Set by page 2')
  const text = await page.getByText('mounted for').textContent()
  const seconds = Number(text.match(/(\d+)s/)[1])
  if (seconds < 2) throw new Error('layout remounted: ' + text)
})
await check('head title', async () => {
  await go('/features/layouts/head')
  await page.fill('main input', 'Hello head')
  await page.waitForFunction(() => document.title === 'Hello head · Inertia × NestJS')
  const meta = await page.locator('meta[name="description"]').getAttribute('content')
  if (!meta?.includes('head demo')) throw new Error('meta ' + meta)
})
await check('events log', async () => {
  await go('/features/events')
  await page.click('main a:has-text("Visit")')
  await page.waitForFunction(() => document.body.innerText.includes('navigate') && document.body.innerText.includes('success'))
})
await check('errors: Error page with status, modal for 418, intercept', async () => {
  await go('/features/errors')
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/throw/404')), page.click('main button:has-text("404")')])
  if (res.status() !== 404) throw new Error('status ' + res.status())
  await expectText('Page not found')
  await go('/features/errors')
  await page.click('main button:has-text("418")')
  await page.locator('iframe').first().waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await go('/features/errors')
  await page.check('text=Intercept with')
  await page.click('main button:has-text("500")')
  await expectText('Intercepted a 500 response.')
  await page.click('text=Visit an unreachable server')
  await expectText('Network error')
})
await check('asset versioning: deploy triggers a full reload', async () => {
  await go('/features/errors/asset-version')
  const versionBefore = await page.getByText('Client version:').textContent()
  await Promise.all([page.waitForEvent('load'), page.click('text=Deploy a new version')])
  await page.waitForLoadState('networkidle')
  const versionAfter = await page.getByText('Client version:').textContent()
  if (versionBefore === versionAfter) throw new Error('version unchanged ' + versionAfter)
  await toast('New version "deployed"')
})
await check('csrf: missing token is rejected', async () => {
  const status = await page.evaluate(async () => (await fetch('/features/links', { method: 'POST', headers: { 'X-Inertia': 'true' }, redirect: 'manual' })).status)
  if (status !== 0 && status !== 302) throw new Error('status ' + status)
})
await check('logout clears history', async () => {
  await go('/features/history')
  await page.click('button:has-text("Sign out")')
  await page.waitForURL(BASE + '/login')
  await page.goBack()
  await page.waitForTimeout(800)
  if (await page.getByText('Sensitive value').count()) throw new Error('encrypted page restored after logout')
})


console.log(results.join('\n'))
console.log(`\n${results.filter((line) => line.startsWith('PASS')).length}/${results.length} passed`)
if (problems.length > 0) console.log('\nConsole problems:\n' + problems.join('\n'))
await browser.close()
process.exit(results.every((line) => line.startsWith('PASS')) && problems.length === 0 ? 0 : 1)
