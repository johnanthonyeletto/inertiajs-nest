import type { Request, Response } from 'express'
import { Header } from './constants.js'
import type { InertiaContext } from './context.js'
import { Responsable } from './responses.js'
import { serializePage } from './serialization.js'
import type { Page, PageProps } from './types.js'

/**
 * An Inertia page response: JSON for Inertia visits, a full HTML document
 * (optionally server-side rendered) for the initial visit.
 */
export class InertiaResponse extends Responsable {
  private statusCode = 200
  private viewData: Record<string, unknown> = {}
  private bigIntegers: boolean | undefined

  constructor(
    private readonly context: InertiaContext,
    readonly component: string,
    private props: PageProps,
  ) {
    super()
  }

  /** Add props to the page. */
  with(key: string | PageProps, value?: unknown): this {
    this.props = typeof key === 'string' ? { ...this.props, [key]: value } : { ...this.props, ...key }
    return this
  }

  /** Add data that is only available to the root view, never to the client. */
  withViewData(key: string | Record<string, unknown>, value?: unknown): this {
    this.viewData = typeof key === 'string' ? { ...this.viewData, [key]: value } : { ...this.viewData, ...key }
    return this
  }

  /** Set the HTTP status, e.g. when rendering an error page. */
  status(code: number): this {
    this.statusCode = code
    return this
  }

  /**
   * Deliver `bigint`s outside the safe integer range as `BigInt`s on the
   * client, overriding the `preserveBigIntegers` config for this response.
   */
  preserveBigIntegers(preserve = true): this {
    this.bigIntegers = preserve
    return this
  }

  toPage(): Promise<Page> {
    return this.context.buildPage(this.component, this.props, { preserveBigIntegers: this.bigIntegers })
  }

  async toResponse(_request: Request, response: Response): Promise<void> {
    const page = await this.toPage()

    if (this.context.isInertia) {
      response.status(this.statusCode).set(Header.INERTIA, 'true').type('json').send(serializePage(page))
      return
    }

    const html = await this.context.renderDocument(page, this.viewData)

    response.status(this.statusCode).type('html').send(html)
  }
}
