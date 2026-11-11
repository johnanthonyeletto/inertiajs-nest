/**
 * Wire-level names defined by the Inertia v3 protocol.
 *
 * @see https://inertiajs.com/docs/v3/core-concepts/the-protocol
 */
export const Header = {
  /** Marks a request (and its JSON response) as an Inertia visit. */
  INERTIA: 'X-Inertia',
  /** Names the error bag validation errors should be scoped to. */
  ERROR_BAG: 'X-Inertia-Error-Bag',
  /** Destination of a full `window.location` visit (409 responses). */
  LOCATION: 'X-Inertia-Location',
  /** Destination (with fragment) of a fresh Inertia visit (409 responses). */
  REDIRECT: 'X-Inertia-Redirect',
  /** The asset version, sent by the client and echoed on version mismatches. */
  VERSION: 'X-Inertia-Version',
  /** The component a partial reload targets. */
  PARTIAL_COMPONENT: 'X-Inertia-Partial-Component',
  /** Comma-separated props to include in a partial reload. */
  PARTIAL_ONLY: 'X-Inertia-Partial-Data',
  /** Comma-separated props to exclude from a partial reload. */
  PARTIAL_EXCEPT: 'X-Inertia-Partial-Except',
  /** Comma-separated props whose merge state should be reset. */
  RESET: 'X-Inertia-Reset',
  /** `append` or `prepend`, sent by the `<InfiniteScroll>` component. */
  INFINITE_SCROLL_MERGE_INTENT: 'X-Inertia-Infinite-Scroll-Merge-Intent',
  /** Comma-separated once-prop keys the client already holds. */
  EXCEPT_ONCE_PROPS: 'X-Inertia-Except-Once-Props',
  /** `prefetch` for prefetch requests. */
  PURPOSE: 'Purpose',
  /** Marks a Precognition (validation-only) request and response. */
  PRECOGNITION: 'Precognition',
  /** Comma-separated fields a Precognition request should validate. */
  PRECOGNITION_VALIDATE_ONLY: 'Precognition-Validate-Only',
  /** Set to `true` on successful Precognition responses. */
  PRECOGNITION_SUCCESS: 'Precognition-Success',
} as const

/** Injection token for the resolved `InertiaConfig`. */
export const INERTIA_CONFIG = Symbol('INERTIA_CONFIG')

/** Injection token for the `InertiaValidator` used by `InertiaValidationPipe`. */
export const INERTIA_VALIDATOR = Symbol('INERTIA_VALIDATOR')

export const PRECOGNITIVE_METADATA = 'inertia:precognitive'

export const ENCRYPT_HISTORY_METADATA = 'inertia:encrypt-history'

/** Request methods whose `302` redirects become `303 See Other` for Inertia visits. */
export const SEE_OTHER_METHODS = ['PUT', 'PATCH', 'DELETE', 'QUERY']

/** Where the production SSR server (`nestjs-inertia ssr:start`) listens by default. */
export const DEFAULT_SSR_URL = 'http://127.0.0.1:13714'

/** The production SSR bundle built by `vite build --ssr`. */
export const DEFAULT_SSR_BUNDLE = 'bootstrap/ssr/app.js'
