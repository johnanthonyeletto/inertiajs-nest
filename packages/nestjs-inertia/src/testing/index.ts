/**
 * Testing helpers (`inertia-nest/testing`), modelled on inertia-laravel's
 * `assertInertia()`. They work with any HTTP client that exposes headers and
 * the response text or body (supertest, light-my-request, `fetch` results
 * after reading the text) and throw plain `AssertionError`s, so they work
 * with Vitest, Jest, and `node:test` alike.
 *
 * ```ts
 * const response = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders())
 *
 * assertInertia(response, (page) =>
 *   page.component('Users/Show').where('user.name', 'Ada').has('posts', 3).missing('user.password'),
 * )
 * ```
 */
import { AssertionError } from 'node:assert'
import { isDeepStrictEqual, inspect } from 'node:util'
import { Header } from '../constants.js'
import { reviveBigInt } from '../serialization.js'
import type { Page } from '../types.js'

/** The parts of an HTTP response the helpers read. */
export interface ResponseLike {
  status?: number
  headers: Record<string, string | string[] | undefined> | Headers
  /** Raw body (supertest's `text`). */
  text?: string
  /** Parsed body (supertest's `body`), used when `text` is absent. */
  body?: unknown
}

/** Extract the page object from an Inertia JSON response or an HTML page load. */
export function inertiaPage(response: ResponseLike): Page {
  const text = response.text ?? (typeof response.body === 'string' ? response.body : undefined)
  let json: string | undefined

  if (header(response, Header.INERTIA)) {
    json = text ?? JSON.stringify(response.body)
  } else if (text !== undefined) {
    json = text.match(/<script[^>]*\bdata-page="[^"]*"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  }

  if (json === undefined) {
    const serverVersion = header(response, Header.VERSION)

    if (response.status === 409 && header(response, Header.LOCATION) !== undefined && serverVersion !== undefined) {
      fail(
        `The server answered with an asset version mismatch (409): it expects version "${serverVersion}". ` +
          'Pass it with inertiaHeaders({ version }) (or { page } from an earlier response).',
      )
    }

    fail('The response is not an Inertia response: it has no X-Inertia header and no data-page script.')
  }

  const page = JSON.parse(json) as Page

  return page.preserveBigIntegers ? (JSON.parse(json, reviveBigInt) as Page) : page
}

/** Assert against an Inertia response. Returns the assertion object for further chaining. */
export function assertInertia(response: ResponseLike, callback?: (page: AssertableInertia) => unknown): AssertableInertia {
  const assertable = new AssertableInertia(inertiaPage(response))
  callback?.(assertable)

  return assertable
}

/**
 * Request headers for an Inertia visit. Pass the page the client holds to
 * build a partial reload (`only`/`except`), as `router.reload()` would.
 */
export function inertiaHeaders(
  options: {
    /** The asset version the client holds. Defaults to the page's, or `''` (matching a dev server or no manifest). */
    version?: string
    /** The page the client holds; supplies the component and version for partial reloads. */
    page?: Page
    /** The component being reloaded, when no `page` is given. */
    component?: string
    only?: string[]
    except?: string[]
    reset?: string[]
    errorBag?: string
  } = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    [Header.INERTIA]: 'true',
    [Header.VERSION]: options.version ?? options.page?.version ?? '',
  }

  if (options.only || options.except) {
    const component = options.component ?? options.page?.component

    if (!component) {
      throw new TypeError('A partial reload (only/except) needs the `page` or `component` being reloaded.')
    }

    headers[Header.PARTIAL_COMPONENT] = component
    if (options.only) headers[Header.PARTIAL_ONLY] = options.only.join(',')
    if (options.except) headers[Header.PARTIAL_EXCEPT] = options.except.join(',')
  }

  if (options.reset) headers[Header.RESET] = options.reset.join(',')
  if (options.errorBag) headers[Header.ERROR_BAG] = options.errorBag

  return headers
}

/** Headers for the follow-up request the client sends to load a page's deferred props (one group, or all). */
export function deferredPropsHeaders(page: Page, group?: string): Record<string, string> {
  const groups = page.deferredProps ?? {}
  const only = group ? (groups[group] ?? []) : Object.values(groups).flat()

  if (only.length === 0) {
    fail(group ? `The page has no deferred props in group "${group}".` : 'The page has no deferred props.')
  }

  return inertiaHeaders({ page, only })
}

/** Fluent assertions against a page object. Paths use dot notation (`user.posts.0.title`). */
export class AssertableInertia {
  constructor(readonly page: Page) {}

  get props(): Record<string, unknown> {
    return this.page.props
  }

  /** The value at a prop path (`undefined` when missing). */
  prop<T = unknown>(path?: string): T {
    return (path === undefined ? this.page.props : lookup(this.page.props, path).value) as T
  }

  component(expected: string): this {
    return this.equal(this.page.component, expected, 'Unexpected Inertia page component.')
  }

  url(expected: string): this {
    return this.equal(this.page.url, expected, 'Unexpected Inertia page url.')
  }

  version(expected: string): this {
    return this.equal(this.page.version, expected, 'Unexpected Inertia asset version.')
  }

  /** The prop exists; optionally with `count` items/keys, or scoped into with a callback. */
  has(path: string, countOrScope?: number | ((scope: AssertableInertia) => unknown)): this {
    const { found, value } = lookup(this.page.props, path)

    if (!found) {
      fail(`Inertia property [${path}] does not exist.`)
    }

    if (typeof countOrScope === 'number') {
      const size = sizeOf(value)

      if (size !== countOrScope) {
        fail(`Inertia property [${path}] does not have the expected size.`, size, countOrScope)
      }
    } else if (countOrScope) {
      countOrScope(new AssertableInertia({ ...this.page, props: value as Record<string, unknown> }))
    }

    return this
  }

  hasAll(paths: string[]): this {
    paths.forEach((path) => this.has(path))
    return this
  }

  missing(path: string): this {
    if (lookup(this.page.props, path).found) {
      fail(`Inertia property [${path}] was found while it was expected to be missing.`)
    }

    return this
  }

  missingAll(paths: string[]): this {
    paths.forEach((path) => this.missing(path))
    return this
  }

  /** The prop equals `expected` (deep, strict), or satisfies a predicate. */
  where(path: string, expected: unknown): this {
    this.has(path)
    const actual = lookup(this.page.props, path).value

    if (typeof expected === 'function') {
      if (!(expected as (value: unknown) => unknown)(actual)) {
        fail(`Inertia property [${path}] was marked as invalid using a closure.`, actual)
      }

      return this
    }

    return this.equal(actual, expected, `Inertia property [${path}] does not match the expected value.`)
  }

  whereAll(expected: Record<string, unknown>): this {
    Object.entries(expected).forEach(([path, value]) => this.where(path, value))
    return this
  }

  /** The prop is announced as deferred (optionally in a specific group). */
  hasDeferred(prop: string, group?: string): this {
    const groups = this.page.deferredProps ?? {}
    const inGroup = group ? (groups[group] ?? []).includes(prop) : Object.values(groups).some((props) => props.includes(prop))

    if (!inGroup) {
      fail(`Inertia property [${prop}] is not deferred${group ? ` in group "${group}"` : ''}.`, groups)
    }

    return this
  }

  /** Flash data is present (and equals `expected`, when given). */
  hasFlash(key: string, ...expected: [unknown?]): this {
    const flash = this.page.flash ?? {}

    if (!(key in flash)) {
      fail(`Flash data [${key}] does not exist.`, flash)
    }

    return expected.length > 0 ? this.equal(flash[key], expected[0], `Flash data [${key}] does not match.`) : this
  }

  missingFlash(key: string): this {
    if (this.page.flash && key in this.page.flash) {
      fail(`Flash data [${key}] was found while it was expected to be missing.`)
    }

    return this
  }

  encryptsHistory(expected = true): this {
    return this.equal(this.page.encryptHistory === true, expected, 'Unexpected encryptHistory flag.')
  }

  clearsHistory(expected = true): this {
    return this.equal(this.page.clearHistory === true, expected, 'Unexpected clearHistory flag.')
  }

  private equal(actual: unknown, expected: unknown, message: string): this {
    if (!isDeepStrictEqual(actual, expected)) {
      fail(message, actual, expected)
    }

    return this
  }
}

function lookup(source: unknown, path: string): { found: boolean; value: unknown } {
  let current = source

  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) {
      return { found: false, value: undefined }
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return { found: true, value: current }
}

function sizeOf(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length
  if (value !== null && typeof value === 'object') return Object.keys(value).length

  return undefined
}

function header(response: ResponseLike, name: string): string | undefined {
  if (typeof Headers !== 'undefined' && response.headers instanceof Headers) {
    return response.headers.get(name) ?? undefined
  }

  const value = (response.headers as Record<string, string | string[] | undefined>)[name.toLowerCase()]

  return Array.isArray(value) ? value[0] : value
}

function fail(message: string, ...values: [actual?: unknown, expected?: unknown]): never {
  const details = values.length === 0 ? '' : values.length === 1 ? `\n  actual: ${inspect(values[0])}` : ''

  throw new AssertionError({
    message: message + details,
    ...(values.length === 2 && { actual: values[0], expected: values[1], operator: 'deepStrictEqual' }),
  })
}
