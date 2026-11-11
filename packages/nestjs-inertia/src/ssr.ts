import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Request } from 'express'
import { DEFAULT_SSR_BUNDLE, DEFAULT_SSR_URL, INERTIA_CONFIG } from './constants.js'
import type { InertiaConfig } from './config.js'
import type { Page } from './types.js'
import { serializePage } from './serialization.js'
import { describeError } from './support.js'
import { Vite } from './vite.js'

export interface SsrResult {
  head: string
  body: string
}

/** The JSON body of a failed render, as classified by the Inertia SSR server. */
export interface SsrError {
  error: string
  type?: 'browser-api' | 'component-resolution' | 'render' | 'connection'
  component?: string
  url?: string
  browserApi?: string
  hint?: string
  stack?: string
  sourceLocation?: string
}

/**
 * Talks to the Inertia SSR server: the `@inertiajs/vite` dev endpoint while
 * Vite is running, or the production server (`node bootstrap/ssr/app.js`).
 * A failed render is never fatal; the page falls back to client rendering.
 */
@Injectable()
export class SsrGateway {
  private readonly logger = new Logger('InertiaSSR')
  private readonly enabled: boolean
  private readonly url: string
  private readonly bundle: string
  private readonly timeout: number
  private readonly except: string[]

  constructor(
    @Inject(INERTIA_CONFIG) config: InertiaConfig,
    private readonly vite: Vite,
  ) {
    const ssr = config.ssr ?? {}

    this.enabled = ssr.enabled ?? true
    this.url = (ssr.url ?? DEFAULT_SSR_URL).replace(/\/$/, '')
    this.bundle = resolve(ssr.bundle ?? DEFAULT_SSR_BUNDLE)
    this.timeout = ssr.timeout ?? 5000
    this.except = ssr.except ?? []
  }

  async dispatch(page: Page, request: Request): Promise<SsrResult | null> {
    if (!this.enabled || this.isExcluded(request.path)) {
      return null
    }

    const hot = this.vite.hotUrl()

    if (!hot && !existsSync(this.bundle)) {
      return null
    }

    const endpoint = hot ? `${hot}/__inertia_ssr` : `${this.url}/render`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializePage(page),
        signal: AbortSignal.timeout(this.timeout),
      })

      const data = (await response.json().catch(() => null)) as
        | { head?: string[]; body?: string }
        | SsrError
        | null

      if (!response.ok) {
        this.report(page, (data as SsrError | null) ?? { error: `SSR server responded with ${response.status}` })
        return null
      }

      // The dev server answers `null` while it's still warming up.
      if (!data || !('body' in data) || typeof data.body !== 'string') {
        return null
      }

      return { head: (data.head ?? []).join('\n    '), body: data.body }
    } catch (error) {
      this.report(page, { error: describeError(error), type: 'connection' })
      return null
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(this.timeout) })).ok
    } catch {
      return false
    }
  }

  private isExcluded(path: string): boolean {
    return this.except.some((pattern) =>
      pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern,
    )
  }

  private report(page: Page, error: SsrError): void {
    const details = [error.type && `[${error.type}]`, error.error, error.hint && `\n  Hint: ${error.hint}`]
      .filter(Boolean)
      .join(' ')

    this.logger.warn(`SSR failed for "${error.component ?? page.component}", falling back to CSR: ${details}`)
  }
}
