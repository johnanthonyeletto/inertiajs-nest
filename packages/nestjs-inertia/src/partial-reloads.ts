import type { Request } from 'express'
import { Header } from './constants.js'
import type { InertiaSession, PartialReloadRequest } from './session.js'

/**
 * One-time session state (flash data, validation errors, history flags) and
 * partial reloads. A partial reload never takes that state, whichever
 * component it names, so a live, deferred or polling reload landing between a
 * redirect and the page it leads to can't swallow it. The exception is the
 * partial reload a form submission sent with `only` leads to: the browser
 * follows its redirect with the same partial headers, and that reload gets
 * the state as it would without `only`.
 */

/** The request's partial-reload headers, or `null` when it isn't a partial reload. */
export function partialReloadOf(request: Request): Omit<PartialReloadRequest, 'url'> | null {
  const component = request.get(Header.PARTIAL_COMPONENT) || null
  const only = request.get(Header.PARTIAL_ONLY) || null
  const except = request.get(Header.PARTIAL_EXCEPT) || null

  return component || only || except ? { component, only, except } : null
}

/**
 * Called for every redirect of an Inertia request. When a form submission
 * (any method but GET) sent as a partial reload is redirected, remember the
 * reload its redirect leads to. When that reload is itself redirected (a
 * guard, a canonical URL), follow it to the new location.
 */
export function rememberRedirectedPartial(request: Request, session: InertiaSession | null, location: string): void {
  const partial = partialReloadOf(request)

  if (!session || !partial) {
    return
  }

  const isSubmission = request.method !== 'GET'
  const expected = session.get('redirectedPartial')

  if (isSubmission || (expected && isExpectedReload(request, partial, expected))) {
    session.set('redirectedPartial', { url: pathOf(location, request.originalUrl), ...partial })
  }
}

/**
 * Whether this request may take one-time session state. Decides once per
 * request: the remembered redirect is used up by the reload that matches it,
 * and forgotten by a full visit.
 */
export function mayConsumeOneTimeState(request: Request, session: InertiaSession | null): boolean {
  // Prefetch responses are cached, so they never take one-time state.
  if (request.get(Header.PURPOSE) === 'prefetch') {
    return false
  }

  const partial = partialReloadOf(request)
  const expected = session?.get('redirectedPartial')

  if (!partial) {
    session?.set('redirectedPartial', undefined)

    return true
  }

  if (expected && isExpectedReload(request, partial, expected)) {
    session?.set('redirectedPartial', undefined)

    return true
  }

  return false
}

function isExpectedReload(
  request: Request,
  partial: Omit<PartialReloadRequest, 'url'>,
  expected: PartialReloadRequest,
): boolean {
  return (
    expected.url === pathOf(request.originalUrl, request.originalUrl) &&
    expected.component === partial.component &&
    expected.only === partial.only &&
    expected.except === partial.except
  )
}

/** The path and query a URL points at, resolved against the current request's. */
function pathOf(url: string, base: string): string {
  const resolved = new URL(url, new URL(base, 'http://inertia.invalid'))

  return resolved.pathname + resolved.search
}
