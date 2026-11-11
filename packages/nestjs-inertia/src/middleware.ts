import { Inject, Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import type { RootViewContext } from './config.js'
import { Header, SEE_OTHER_METHODS } from './constants.js'
import { isInertiaRequest, sendVersionConflict, varyOnSend } from './express.js'
import { InertiaManager } from './manager.js'
import { runWithRequest } from './request-context.js'
import { defaultRootView } from './root-view.js'
import type { PageProps } from './types.js'

/**
 * Creates the per-request `InertiaContext` and enforces the protocol rules
 * that apply to every response: asset version checks, `Vary`, 303 redirects
 * after PUT/PATCH/DELETE/QUERY, fragment redirects, and redirecting back on
 * empty responses.
 *
 * Extend it to share data, set the asset version, or customise the root view,
 * then apply your subclass after the session middleware:
 *
 * ```ts
 * @Injectable()
 * export class HandleInertiaRequests extends InertiaMiddleware {
 *   share(request: Request) {
 *     return { auth: { user: request.user ?? null } }
 *   }
 * }
 * ```
 *
 * The adapter's services are property-injected, so subclasses are free to
 * declare their own constructor dependencies.
 */
@Injectable()
export class InertiaMiddleware implements NestMiddleware {
  @Inject(InertiaManager)
  protected readonly inertiaManager!: InertiaManager

  /**
   * Props shared with every page, in addition to the always-present `errors`.
   * Resolved when a page renders, so it sees state set by later middleware
   * and guards (e.g. the authenticated user).
   */
  share(_request: Request): PageProps | Promise<PageProps> {
    return {}
  }

  /** The current asset version. Defaults to a hash of the Vite manifest. */
  version(_request: Request): string | null | undefined | Promise<string | null | undefined> {
    return this.inertiaManager.assetVersion()
  }

  /** Renders the HTML document for full page visits. */
  rootView(context: RootViewContext): string | Promise<string> {
    return defaultRootView(context)
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const inertia = this.inertiaManager.createContext(request, response, {
      share: (req) => this.share(req),
      version: (req) => this.version(req),
      rootView: (context) => this.rootView(context),
      onVersionChange: (req, res, version) => this.onVersionChange(req, res, version),
    })

    request.inertia = inertia
    varyOnSend(response, Header.INERTIA)
    this.handleRedirects(request, response)
    this.handleEmptyResponses(request, response)

    runWithRequest(request, response, next)
  }

  /**
   * Answers a stale client with a `409` telling it to reload the page. Like
   * the reference adapter, the asset version is compared when a page is
   * sent (after the handler ran, so `inertia.setVersion()` counts), and only
   * for GET visits: the redirect after a form submission may be answered
   * with a version mismatch, the submission itself never is.
   */
  protected onVersionChange(request: Request, response: Response, version: string): void {
    sendVersionConflict(request, response, version)
  }

  /**
   * Route every redirect (controllers, guards, filters, `@Redirect()`) through
   * the protocol rules:
   *
   * - A 302 after PUT/PATCH/DELETE/QUERY becomes 303, so the browser follows with a GET.
   * - A redirect to a URL with a fragment becomes a 409 with `X-Inertia-Redirect`,
   *   since XHR redirects drop the fragment.
   */
  private handleRedirects(request: Request, response: Response): void {
    const redirect = response.redirect.bind(response) as (status: number, url: string) => void

    response.redirect = ((statusOrUrl: number | string, maybeUrl?: number | string) => {
      let status = 302
      let url: string

      if (typeof statusOrUrl === 'number') {
        status = statusOrUrl
        url = String(maybeUrl)
      } else {
        url = statusOrUrl
        if (typeof maybeUrl === 'number') status = maybeUrl
      }

      if (isInertiaRequest(request)) {
        if (status === 302 && SEE_OTHER_METHODS.includes(request.method)) {
          status = 303
        }

        if (url.includes('#') && request.get(Header.PURPOSE) !== 'prefetch') {
          response.status(409).set(Header.REDIRECT, url).end()
          return
        }
      }

      redirect(status, url)
    }) as Response['redirect']
  }

  /**
   * An empty successful response to an Inertia visit (e.g. a handler that
   * only performs a side effect) redirects back, like the reference adapter.
   */
  private handleEmptyResponses(request: Request, response: Response): void {
    const send = response.send

    response.send = function (this: Response, ...args: Parameters<Response['send']>) {
      const [body] = args
      const empty = body === undefined || body === null || body === ''

      if (
        empty &&
        !this.headersSent &&
        (this.statusCode === 200 || this.statusCode === 201) &&
        isInertiaRequest(request) &&
        request.inertia
      ) {
        void request.inertia.back().toResponse(request, this)
        return this
      }

      return send.apply(this, args)
    } as Response['send']
  }
}
