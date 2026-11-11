import type { Request, Response } from 'express'
import { Header } from './constants.js'
import { isInertiaRequest } from './support.js'

/**
 * A value a controller can return to take full control of the HTTP response,
 * like Laravel's `Responsable`. The `InertiaInterceptor` sends it.
 */
export abstract class Responsable {
  abstract toResponse(request: Request, response: Response): Promise<void> | void
}

export class RedirectResponse extends Responsable {
  constructor(
    readonly url: string,
    readonly status = 302,
  ) {
    super()
  }

  toResponse(_request: Request, response: Response): void {
    // `response.redirect` is wrapped by the Inertia middleware, which applies
    // the protocol's 303 and fragment-redirect rules.
    response.redirect(this.status, this.url)
  }
}

/**
 * An external redirect. Inertia visits can't follow a cross-origin redirect,
 * so the client is told to perform a full `window.location` visit instead.
 */
export class LocationResponse extends Responsable {
  constructor(readonly url: string) {
    super()
  }

  toResponse(request: Request, response: Response): void {
    if (isInertiaRequest(request)) {
      response.status(409).set(Header.LOCATION, this.url).end()
    } else {
      response.redirect(302, this.url)
    }
  }
}

/** A plain (non-Inertia) HTML response. */
export class HtmlResponse extends Responsable {
  constructor(
    readonly html: string,
    readonly status = 200,
  ) {
    super()
  }

  toResponse(_request: Request, response: Response): void {
    response.status(this.status).type('html').send(this.html)
  }
}
