import { Inject, Injectable } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { InertiaConfig, RootViewContext } from './config.js'
import { INERTIA_CONFIG } from './constants.js'
import { InertiaContext } from './context.js'
import { expressSession, type InertiaSession, type InertiaSessionResolver } from './session.js'
import { SsrGateway } from './ssr.js'
import type { PageProps } from './types.js'
import { Vite } from './vite.js'

/** The request-specific behaviour an `InertiaMiddleware` subclass customises. */
export interface InertiaHooks {
  share(request: Request): PageProps | Promise<PageProps>
  version(request: Request): string | null | undefined | Promise<string | null | undefined>
  rootView(context: RootViewContext): string | Promise<string>
  /** Answers a stale client. Defaults to a `409` with `X-Inertia-Location`. */
  onVersionChange?(request: Request, response: Response, version: string): void
}

/** Holds the adapter's configuration and services, and creates per-request contexts. */
@Injectable()
export class InertiaManager {
  private readonly sessionResolver: InertiaSessionResolver

  constructor(
    @Inject(INERTIA_CONFIG) readonly config: InertiaConfig,
    readonly vite: Vite,
    readonly ssr: SsrGateway,
  ) {
    this.sessionResolver = config.session ?? expressSession()
  }

  createContext(request: Request, response: Response, hooks: InertiaHooks): InertiaContext {
    return new InertiaContext(request, response, this, hooks)
  }

  session(request: Request): InertiaSession | null {
    return this.sessionResolver(request)
  }

  /** The default asset version: a hash of the Vite manifest (none while the dev server runs). */
  assetVersion(): string | null {
    return this.vite.manifestHash()
  }
}
