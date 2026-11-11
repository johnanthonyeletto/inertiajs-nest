/**
 * Conformance transport port. Replaces upstream `tests/app/helpers.js` at
 * require time (see preload.cjs); the upstream checkout is never modified.
 *
 * Page assembly (component name, url, version, route-supplied metadata,
 * alwaysProps, every HTML template branch) is identical to upstream's
 * helpers.js. The protocol engine is routed through `inertia-nest` instead of
 * the suite's inline code:
 *
 *   - partial-reload filtering and prop evaluation: `PropsResolver`
 *     (the route's props are handed over as-is, closures included)
 *   - Inertia-request detection: `isInertiaRequest`
 *   - JSON transport: `serializePage`
 *   - `<script type="application/json">` transport: `encodePageForScript`
 *   - big integers: `serializePage` + `encodeBigInt` (instead of upstream's
 *     pre-encoding walk in `buildPageData`)
 *   - `location()`: `LocationResponse`
 *   - `redirect()`: the redirect rules `InertiaMiddleware` installs on every
 *     response (409 + X-Inertia-Redirect for fragment URLs)
 *
 * Diff against conformance/inertia/tests/app/helpers.js to see every change.
 */
const path = require('path')
const fs = require('fs')

// Upstream checkout's test server dir: ssr.js and the built test-apps live there.
const APP_DIR = path.resolve(__dirname, 'inertia/tests/app')

const package = process.env.PACKAGE || 'vue3'

const ssr = require(path.join(APP_DIR, 'ssr'))

// The adapter, loaded exactly as an app would load it (ESM via require(esm),
// Node >= 22.12; resolved through the workspace symlink in node_modules).
const {
  Header,
  InertiaMiddleware,
  LocationResponse,
  PropsResolver,
  encodePageForScript,
  isInertiaRequest,
  serializePage,
} = require('inertia-nest')

// The redirect rules the adapter's middleware installs on every response. It is
// a private method, but it uses no instance state, so it can be applied to a
// bare Express response. Fail loudly if a refactor renames it.
const installRedirectRules = InertiaMiddleware.prototype.handleRedirects
if (typeof installRedirectRules !== 'function') {
  throw new Error('[conformance] InertiaMiddleware.prototype.handleRedirects not found; update conformance/helpers.cjs')
}

// Audit trail: Playwright pipes the web server's stderr into the run output, so
// this line proves the swap happened in the server it spawned.
process.stderr.write(
  `[conformance] helpers swapped -> ${__filename} (inertia-nest: ${require.resolve('inertia-nest')})\n`,
)

/** Whether a page contains a bigint or a `{"$bigint": ...}` marker (upstream's opt-in stand-in). */
const containsBigInts = (value) => {
  if (typeof value === 'bigint') {
    return true
  }

  if (Array.isArray(value)) {
    return value.some(containsBigInts)
  }

  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    return Object.entries(value).some(([key, nested]) => key === '$bigint' || containsBigInts(nested))
  }

  return false
}

const buildPageData = (req, data) => {
  const page = {
    component: req.path
      .slice(1)
      .split('/')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('/')
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(''),
    props: {},
    url: req.originalUrl,
    version: null,
    ...data,
  }

  // Stands in for the Laravel opt-in by flagging pages that carry big integers
  // or markers. A route can pass `preserveBigIntegers: false` to act like an
  // app that builds its own markers. The encoding itself happens at transport
  // time, in inertia-nest's `serializePage` (`encodeBigInt` replacer).
  if (page.preserveBigIntegers === undefined && containsBigInts(page)) {
    page.preserveBigIntegers = true
  }

  return page
}

/**
 * Replacement for upstream's `processPartialProps`: inertia-nest's
 * `PropsResolver` reads the partial-reload headers from the Express request,
 * filters the props and evaluates closures. The route's props are passed
 * as-is and never rewritten, so closures are called the way the adapter calls
 * them (no arguments), not as upstream's `fn(data.props)`; see "Known
 * deviations" in README.md. Metadata the routes precompute (deferredProps,
 * mergeProps, ...) is kept; the resolver can only add keys the route did not set.
 */
const processProps = async (req, data) => {
  const resolver = new PropsResolver(req, data.component, { exposeSharedPropKeys: false })
  const [resolvedProps, metadata] = await resolver.resolve({}, data.props || {})

  data.props = resolvedProps

  for (const [key, value] of Object.entries(metadata)) {
    if (data[key] === undefined) {
      data[key] = value
    }
  }

  return data
}

const sendJson = (res, data) => {
  res.header('Vary', 'Accept')
  res.header(Header.INERTIA, true)
  return res.status(200).type('json').send(serializePage(data))
}

// The page as the SSR server receives it (upstream posts it with JSON.stringify,
// which cannot carry bigints, so encode them first).
const forSsr = (data) => JSON.parse(serializePage(data))

const applyDefaultNonce = (req, html) => {
  if (req.query.nonce !== 'default') {
    return html
  }

  return html.replace('<script>', '<script nonce="test-default-nonce">')
}

/**
 * Upstream's render helpers are synchronous, so a throw becomes Express's 500.
 * These are async, and some routes call them without returning the promise
 * (e.g. from a setTimeout), so failures are turned into a 500 here instead of
 * an unhandled rejection that would take the whole test server down.
 */
const guarded =
  (fn) =>
  async (req, res, data) => {
    try {
      return await fn(req, res, data)
    } catch (error) {
      process.stderr.write(`[conformance] ${req.method} ${req.originalUrl} failed: ${error?.stack ?? error}\n`)

      if (!res.headersSent) {
        res.status(500).type('text').send(String(error?.stack ?? error))
      }
    }
  }

module.exports = {
  package,
  render: guarded(async (req, res, data) => {
    data = buildPageData(req, data)

    if (data.component.startsWith('InfiniteScroll') && req.query.absolutePageUrl) {
      // Support absolute URL format for testing URL preservation
      const protocol = req.protocol
      const host = req.get('host')
      data.url = `${protocol}://${host}${req.originalUrl}`
    }

    data = await processProps(req, data)

    if (data.alwaysProps) {
      // To simulate Inertia::always() in the Laravel adapter...
      data.props = { ...data.props, ...data.alwaysProps }
      delete data.alwaysProps
    }

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const html = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index.html'))
      .toString()
      .replace('{{ headAttribute }}', 'data-inertia')
      .replace("'{{ placeholder }}'", serializePage(data))

    return res.status(200).send(applyDefaultNonce(req, html))
  }),
  renderWithPlainTitle: guarded(async (req, res, data) => {
    data = buildPageData(req, data)
    data = await processProps(req, data)

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const html = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index.html'))
      .toString()
      .replace(' {{ headAttribute }}', '')
      .replace("'{{ placeholder }}'", serializePage(data))

    return res.status(200).send(applyDefaultNonce(req, html))
  }),
  renderUnified: guarded(async (req, res, data) => {
    data = buildPageData(req, data)
    data = await processProps(req, data)

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const jsonData = encodePageForScript(data)

    const html = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index-unified.html'))
      .toString()
      .replace('{{ headAttribute }}', data.component === 'Head/Dataset' ? 'data-inertia' : 'inertia')
      .replace('{{ placeholder }}', jsonData)

    return res.status(200).send(applyDefaultNonce(req, html))
  }),
  renderSSR: guarded(async (req, res, data) => {
    data = buildPageData(req, data)

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const ssrResult = await ssr.render(forSsr(data))
    const htmlTemplate = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index.html'))
      .toString()

    const headContent = ssrResult.head ? ssrResult.head.join('\n    ') : ''

    const html = htmlTemplate
      .replace('{{ headAttribute }}', 'data-inertia')
      .replace(/<script>\s*window\.initialPage = '{{ placeholder }}'\s*<\/script>/, headContent)
      .replace('<div id="app"></div>', ssrResult.body)

    return res.status(200).send(html)
  }),
  renderSSRAuto: guarded(async (req, res, data) => {
    data = buildPageData(req, data)

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const ssrResult = await ssr.renderAuto(forSsr(data))
    const htmlTemplate = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index.html'))
      .toString()

    const headContent = ssrResult.head ? ssrResult.head.join('\n    ') : ''

    const html = htmlTemplate
      .replace('{{ headAttribute }}', 'inertia')
      .replace(/<script>\s*window\.initialPage = '{{ placeholder }}'\s*<\/script>/, headContent)
      .replace('<div id="app"></div>', ssrResult.body)

    return res.status(200).send(html)
  }),
  renderAuto: guarded(async (req, res, data) => {
    data = buildPageData(req, data)
    data = await processProps(req, data)

    if (isInertiaRequest(req)) {
      return sendJson(res, data)
    }

    const jsonData = encodePageForScript(data)

    const html = fs
      .readFileSync(path.resolve(APP_DIR, '../../packages/', package, 'test-app/dist/index-auto.html'))
      .toString()
      .replace('{{ headAttribute }}', data.component === 'Head/Dataset' ? 'data-inertia' : 'inertia')
      .replace('{{ placeholder }}', jsonData)

    return res.status(200).send(applyDefaultNonce(req, html))
  }),
  // inertia-nest semantics: 409 + X-Inertia-Location for Inertia requests, a
  // plain 302 otherwise. A version, when given, is echoed the way the
  // middleware answers a stale client.
  location: (res, href, version) => {
    if (version) {
      res.header(Header.VERSION, version)
    }

    return new LocationResponse(href).toResponse(res.req, res)
  },
  // inertia-nest semantics: the middleware's redirect rules turn a redirect to
  // a fragment URL into 409 + X-Inertia-Redirect (except for prefetches) and
  // promote 302 to 303 after PUT/PATCH/DELETE.
  redirect: (res, href) => {
    installRedirectRules(res.req, res)
    return res.redirect(href)
  },
}
