import { Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { Header } from './constants.js'
import { sendVersionConflict } from './express.js'
import type { InertiaHooks, InertiaManager } from './manager.js'
import { AlwaysProp, OnceProp } from './props.js'
import { PropsResolver } from './props-resolver.js'
import { InertiaResponse } from './response.js'
import { LocationResponse, RedirectResponse } from './responses.js'
import { encodePageForScript } from './serialization.js'
import type { InertiaSession } from './session.js'
import {
  describeError,
  type ErrorMessages,
  errorStack,
  isInertiaRequest,
  normalizeErrorMessages,
  setPath,
} from './support.js'
import type { ComponentProps, Page, PageProps } from './types.js'

export type { ErrorMessages }

const logger = new Logger('Inertia')
let warnedAboutSession = false

export interface BuildPageOptions {
  preserveBigIntegers?: boolean
}

/**
 * The per-request Inertia API: render pages, share data, flash data, and
 * redirect. Inject it into controllers with the `@Inertia()` decorator.
 */
export class InertiaContext {
  private shared: PageProps = {}
  private versionOverride: string | null = null
  private encryptHistoryEnabled: boolean
  private ssrEnabled = true

  constructor(
    readonly request: Request,
    readonly response: Response,
    private readonly manager: InertiaManager,
    private readonly hooks: InertiaHooks,
  ) {
    this.encryptHistoryEnabled = manager.config.encryptHistory ?? false
  }

  /** Whether this is an Inertia (XHR) visit rather than a full page load. */
  get isInertia(): boolean {
    return isInertiaRequest(this.request)
  }

  get isPrefetch(): boolean {
    return this.request.get(Header.PURPOSE) === 'prefetch'
  }

  get isPrecognitive(): boolean {
    return this.request.precognitive === true
  }

  /** Whether this is a partial reload of the given component. */
  isPartialReloadOf(component: string): boolean {
    return this.request.get(Header.PARTIAL_COMPONENT) === component
  }

  /** Share props with the page rendered by this request. Dot-notation keys nest. */
  share(key: string | PageProps, value?: unknown): this {
    if (typeof key === 'string') {
      setPath(this.shared, key, value)
    } else {
      this.shared = { ...this.shared, ...key }
    }

    return this
  }

  /** Share a prop that is resolved once and remembered by the client. */
  shareOnce(key: string, callback: () => unknown): OnceProp {
    const prop = new OnceProp(callback)
    this.share(key, prop)

    return prop
  }

  getShared(): PageProps {
    return this.shared
  }

  /** Render a page component. */
  render<C extends string>(component: C, props?: ComponentProps<C>): InertiaResponse {
    return new InertiaResponse(this, component, (props ?? {}) as PageProps)
  }

  /** Redirect, applying the protocol's 303 and fragment rules automatically. */
  redirect(url: string, status = 302): RedirectResponse {
    return new RedirectResponse(url, status)
  }

  /** Redirect to the previous page. */
  back(fallback = '/'): RedirectResponse {
    return new RedirectResponse(this.request.get('Referer') ?? fallback)
  }

  /** Perform a full `window.location` visit, e.g. to an external site. */
  location(url: string): LocationResponse {
    return new LocationResponse(url)
  }

  /**
   * Flash data to the next rendered page. Flash data is exposed through the
   * page object's `flash` field and is not persisted in history state.
   */
  flash(key: string | Record<string, unknown>, value?: unknown): this {
    const session = this.session()

    if (session) {
      const data = typeof key === 'string' ? { [key]: value } : key
      session.set('flash', { ...session.get('flash'), ...data })
    }

    return this
  }

  getFlashed(): Record<string, unknown> {
    return this.session()?.get('flash') ?? {}
  }

  /** Flash validation errors to the next rendered page. */
  withErrors(errors: ErrorMessages, bag = 'default'): this {
    const session = this.session()

    if (session) {
      const current = session.get('errors')
      session.set('errors', { ...current, [bag]: { ...current?.[bag], ...normalizeErrorMessages(errors) } })
    }

    return this
  }

  /** Clear any encrypted history state on the next rendered page (e.g. after logout). */
  clearHistory(): this {
    this.session()?.set('clearHistory', true)
    return this
  }

  /** Carry the URL fragment of the original request across the next redirect. */
  preserveFragment(): this {
    this.session()?.set('preserveFragment', true)
    return this
  }

  /** Encrypt the history state of the page rendered by this request. */
  encryptHistory(encrypt = true): this {
    this.encryptHistoryEnabled = encrypt
    return this
  }

  /** Skip server-side rendering for this request. */
  disableSsr(disable = true): this {
    this.ssrEnabled = !disable
    return this
  }

  /** Override the asset version for this request. */
  setVersion(version: string): this {
    this.versionOverride = version
    return this
  }

  async getVersion(): Promise<string> {
    if (this.versionOverride !== null) {
      return this.versionOverride
    }

    return String((await this.hooks.version(this.request)) ?? '')
  }

  /**
   * For an Inertia GET visit from a client with stale assets, answer with
   * the version-change response (a `409`) and return `true`. Called after
   * the handler ran, so a version set during the request counts.
   */
  async handleVersionChange(): Promise<boolean> {
    if (!this.isInertia || this.request.method !== 'GET') {
      return false
    }

    const version = await this.getVersion()

    if ((this.request.get(Header.VERSION) ?? '') === version) {
      return false
    }

    ;(this.hooks.onVersionChange ?? sendVersionConflict)(this.request, this.response, version)

    return true
  }

  /** Resolve the props for a component and assemble the page object. */
  async buildPage(component: string, props: PageProps, options: BuildPageOptions = {}): Promise<Page> {
    const resolver = new PropsResolver(this.request, component, {
      exposeSharedPropKeys: this.manager.config.exposeSharedPropKeys,
      onRescue: (error, path) =>
        logger.error(`Rescued deferred prop "${path}": ${describeError(error)}`, errorStack(error)),
    })

    const [resolvedProps, metadata] = await resolver.resolve(await this.resolveSharedProps(), props)
    const clearHistory = this.pullSessionFlag('clearHistory')
    const preserveFragment = this.pullSessionFlag('preserveFragment')
    const flash = this.pullFlashed()
    const preserveBigIntegers = options.preserveBigIntegers ?? this.manager.config.preserveBigIntegers ?? false

    return {
      component,
      props: resolvedProps,
      url: this.request.originalUrl,
      version: await this.getVersion(),
      ...metadata,
      ...(clearHistory && { clearHistory: true }),
      ...(this.encryptHistoryEnabled && { encryptHistory: true }),
      ...(flash && { flash }),
      ...(preserveFragment && { preserveFragment: true }),
      ...(preserveBigIntegers && { preserveBigIntegers: true }),
    }
  }

  /** Render the HTML document for a full page visit. */
  async renderDocument(page: Page, viewData: Record<string, unknown> = {}): Promise<string> {
    const id = this.manager.config.rootElementId ?? 'app'
    const ssr = this.ssrEnabled ? await this.manager.ssr.dispatch(page, this.request) : null

    return this.hooks.rootView({
      page,
      head: ssr?.head ?? '',
      body:
        ssr?.body ??
        `<script data-page="${id}" type="application/json">${encodePageForScript(page)}</script><div id="${id}"></div>`,
      assets: this.manager.vite.tags(page.component),
      viewData,
      request: this.request,
    })
  }

  private async resolveSharedProps(): Promise<PageProps> {
    const shared = await this.hooks.share(this.request)

    return {
      errors: new AlwaysProp(() => this.resolveValidationErrors()),
      ...shared,
      ...this.shared,
    }
  }

  /**
   * Validation errors are flashed under named bags. A request carrying the
   * `X-Inertia-Error-Bag` header receives the default bag under that name.
   */
  private resolveValidationErrors(): Record<string, unknown> {
    const session = this.session(false)

    // Prefetch responses are cached, so they must not consume one-time state.
    const errors = session && !this.isPrefetch ? session.pull('errors') : undefined

    if (!errors) {
      return {}
    }

    const bags = Object.fromEntries(
      Object.entries(errors).map(([bag, fields]) => [
        bag,
        Object.fromEntries(
          Object.entries(fields).map(([field, messages]) => [
            field,
            this.manager.config.withAllErrors ? messages : messages[0],
          ]),
        ),
      ]),
    )

    const errorBag = this.request.get(Header.ERROR_BAG)

    if (bags.default && errorBag) {
      return { [errorBag]: bags.default }
    }

    return bags.default ?? bags
  }

  private pullFlashed(): Record<string, unknown> | null {
    const session = this.session(false)

    if (!session || this.isPrefetch) {
      return null
    }

    const flash = session.pull('flash')

    return flash && Object.keys(flash).length > 0 ? flash : null
  }

  private pullSessionFlag(flag: 'clearHistory' | 'preserveFragment'): boolean {
    const session = this.session(false)

    if (!session || this.isPrefetch) {
      return false
    }

    return session.pull(flag) === true
  }

  /** The request's session; warns once when state is written without one. */
  private session(writing = true): InertiaSession | null {
    const session = this.manager.session(this.request)

    if (!session && writing && !warnedAboutSession) {
      warnedAboutSession = true
      logger.warn(
        'No session found: flash data, validation errors, and history flags are discarded. ' +
          'Apply a session middleware (e.g. express-session) before InertiaMiddleware, or configure `session`.',
      )
    }

    return session
  }
}
