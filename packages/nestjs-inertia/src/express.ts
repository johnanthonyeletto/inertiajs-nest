/**
 * Express-specific glue: the `Request` augmentation and helpers that work on
 * Express's request and response objects. Re-exported from the package root.
 */
import type { Request, Response } from 'express'
import { Header } from './constants.js'
import type { InertiaContext } from './context.js'

declare module 'express-serve-static-core' {
  interface Request {
    /** The Inertia context for this request, created by `InertiaMiddleware`. */
    inertia?: InertiaContext
    /** Set when a `@Precognitive()` route receives a Precognition request. */
    precognitive?: boolean
  }
}

/** Whether the request is an Inertia (XHR) visit rather than a full page load. */
export function isInertiaRequest(request: Request): boolean {
  return Boolean(request.get(Header.INERTIA))
}

const VARY = Symbol('inertia.vary')

/**
 * Append `field` to the response's `Vary` header just before the headers are
 * written, so a route that sets `Vary` itself (`@Header('Vary', …)`,
 * `res.set('Vary', …)`) can't drop it. Existing values are kept and empty
 * ones discarded, like Laravel's after-response middleware.
 */
export function varyOnSend(response: Response, field: string): void {
  const target = response as Response & { [VARY]?: Set<string> }

  if (target[VARY]) {
    target[VARY].add(field)
    return
  }

  const fields = new Set([field])
  target[VARY] = fields

  const writeHead = response.writeHead

  // Node calls `writeHead()` for implicit headers too (`end()`, `write()`).
  response.writeHead = function (this: Response, ...args: unknown[]) {
    if (!this.headersSent) {
      fields.forEach((name) => this.vary(name))
    }

    return (writeHead as (...args: unknown[]) => Response).apply(this, args)
  } as Response['writeHead']
}

const HANDLED = Symbol('inertia.handled')

/**
 * Marks a response the adapter has written itself (a page, redirect, or
 * location visit returned from a handler). Nest still replies with the
 * handler's (now empty) result afterwards; for this one response, that
 * reply is ignored instead of failing with "headers already sent".
 */
export function markResponseHandled(response: Response): void {
  const target = response as Response & { [HANDLED]?: true }

  if (target[HANDLED]) {
    return
  }

  target[HANDLED] = true

  // Nest replies with `send()`/`json()`, or with `redirect()`/`render()`
  // for `@Redirect()`/`@Render()` handlers.
  for (const method of ['send', 'json', 'redirect', 'render'] as const) {
    const original = response[method] as (...args: unknown[]) => unknown

    ;(response as unknown as Record<string, unknown>)[method] = function (this: Response, ...args: unknown[]) {
      return this.headersSent ? this : original.apply(this, args)
    }
  }
}

/** Answers a stale client with a `409` and `X-Inertia-Location`, telling it to reload the page. */
export function sendVersionConflict(request: Request, response: Response, version: string): void {
  response
    .status(409)
    .set(Header.LOCATION, `${request.protocol}://${request.get('host')}${request.originalUrl}`)
    .set(Header.VERSION, version)
    .end()
}
