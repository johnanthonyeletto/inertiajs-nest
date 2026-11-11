import type { Request } from 'express'
import type { Page } from './types.js'
import type { InertiaSessionResolver } from './session.js'
import type { InertiaValidator } from './validation.js'

/** Everything a root view needs to render the HTML document of a full page visit. */
export interface RootViewContext {
  /** The page object, e.g. for server-rendering a `<title>`. */
  page: Page
  /** SSR head elements (title, meta tags), or an empty string without SSR. */
  head: string
  /** The page-object script and mounting point, or the server-rendered markup. */
  body: string
  /** Script, stylesheet, and preload tags for the client bundle. */
  assets: string
  /** Extra data passed with `InertiaResponse.withViewData()`. */
  viewData: Record<string, unknown>
  request: Request
}

export interface ViteConfig {
  /** Client entry points, relative to the project root. Defaults to `['resources/js/app.tsx']`. */
  entry?: string[]
  /**
   * File written by the Vite dev server while it is running (see the
   * `inertia-nest/vite` plugin). Defaults to `public/hot`.
   */
  hotFile?: string
  /** Directory served at the web root. Defaults to `public`. */
  publicDirectory?: string
  /** Build output directory, relative to the public directory. Defaults to `build`. */
  buildDirectory?: string
  /**
   * Inject the `@vitejs/plugin-react` refresh preamble in development.
   * Defaults to `true`; set `false` for Vue and Svelte.
   */
  reactRefresh?: boolean
  /** Directory containing page components, used to preload the current page chunk. */
  pagesDirectory?: string
  /** Page component file extension (e.g. `.vue`). By default, any extension matches. */
  pageExtension?: string
}

export interface SsrConfig {
  /** Defaults to `true`. SSR is skipped while neither the dev server nor the bundle is available. */
  enabled?: boolean
  /** Production SSR server (`nestjs-inertia ssr:start`). Defaults to `http://127.0.0.1:13714`. */
  url?: string
  /** The production SSR bundle; SSR is skipped while it doesn't exist. Defaults to `bootstrap/ssr/app.js`. */
  bundle?: string
  /** Request timeout in milliseconds. Defaults to `5000`. */
  timeout?: number
  /** Paths (supporting a trailing `*`) that should never be server-side rendered. */
  except?: string[]
}

export interface InertiaConfig {
  /** The id of the root element. Must match the client's `createInertiaApp({ id })`. Defaults to `app`. */
  rootElementId?: string
  /** Encrypt the history state of every page by default. */
  encryptHistory?: boolean
  /** Emit `sharedProps` so instant visits can carry shared props over. Defaults to `true`. */
  exposeSharedPropKeys?: boolean
  /** Send every validation message per field instead of only the first. */
  withAllErrors?: boolean
  /**
   * Deliver `bigint` values outside JavaScript's safe integer range as
   * `{"$bigint": "<digits>"}` markers, which the client revives as `BigInt`s.
   * Can be toggled per response with `InertiaResponse.preserveBigIntegers()`.
   */
  preserveBigIntegers?: boolean
  /**
   * Where flash data, validation errors, and history flags are kept between
   * requests. Defaults to `expressSession()` (`request.session` from express-session).
   */
  session?: InertiaSessionResolver
  /** Validates DTOs for `InertiaValidationPipe`, e.g. `classValidator()` or `zodValidator()`. */
  validator?: InertiaValidator
  vite?: ViteConfig
  ssr?: SsrConfig
}

/** Identity helper that types an Inertia configuration object. */
export function defineConfig(config: InertiaConfig): InertiaConfig {
  return config
}
