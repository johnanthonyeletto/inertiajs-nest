/**
 * Protocol types, importable from both server and client code:
 *
 * ```ts
 * import type { Page, SharedProps } from '@johnanthonyeletto/nestjs-inertia/types'
 * ```
 *
 * This module has no runtime code.
 */
import type { Prop } from './props.js'

export type PageProps = Record<string, unknown>

/** Pagination cursor emitted under `scrollProps` for infinite scroll. */
export interface ScrollMetadata {
  pageName: string
  previousPage: number | string | null
  nextPage: number | string | null
  currentPage: number | string | null
}

/** A channel as announced to the client: its unprefixed name and its type. */
export interface LiveChannel {
  name: string
  type: 'public' | 'private' | 'presence' | 'encrypted-private'
}

/** The events on one channel that refresh a live prop. */
export interface LiveListener {
  channel: LiveChannel
  events: string[]
}

/** A live prop's entry under the page's `liveProps`. */
export interface LivePropMetadata {
  listeners: LiveListener[]
  /** Milliseconds between reloads. Omitted when the client's default applies. */
  throttle?: number
}

/** Page-object fields describing how the client should treat individual props. */
export interface PageMetadata {
  sharedProps?: string[]
  mergeProps?: string[]
  prependProps?: string[]
  deepMergeProps?: string[]
  matchPropsOn?: string[]
  deferredProps?: Record<string, string[]>
  rescuedProps?: string[]
  scrollProps?: Record<string, ScrollMetadata & { reset: boolean }>
  onceProps?: Record<string, { prop: string; expiresAt: number | null }>
  liveProps?: Record<string, LivePropMetadata>
}

/** The page object exchanged between the server and the Inertia client. */
export interface Page<TProps extends PageProps = PageProps> extends PageMetadata {
  component: string
  props: TProps
  url: string
  version: string
  encryptHistory?: true
  clearHistory?: true
  preserveFragment?: true
  preserveBigIntegers?: true
  flash?: Record<string, unknown>
}

/**
 * Augment to type the props shared with every page:
 *
 * ```ts
 * declare module '@johnanthonyeletto/nestjs-inertia/types' {
 *   interface SharedProps {
 *     auth: { user: { id: number; name: string } | null }
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SharedProps {}

/**
 * Augment to type each page component's props. `inertia.render()` then checks
 * the props passed for that component:
 *
 * ```ts
 * declare module '@johnanthonyeletto/nestjs-inertia/types' {
 *   interface InertiaPages {
 *     'Users/Show': { user: User; stats: Stats }
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InertiaPages {}

/** A value as it may be passed to `render()`: plain, lazy, or wrapped in a prop type. */
export type PropValue<T> = T | Promise<T> | (() => T | Promise<T>) | Prop

/** The props `render()` accepts for a component, typed when the component is in `InertiaPages`. */
export type ComponentProps<C extends string> = C extends keyof InertiaPages
  ? { [K in keyof InertiaPages[C]]: PropValue<InertiaPages[C][K]> } & PageProps
  : PageProps
