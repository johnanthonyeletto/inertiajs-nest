/**
 * Prop types understood by the props resolver. They mirror the prop types of
 * the reference Laravel adapter, including their fluent APIs, so every prop
 * category described by the protocol (always, optional, deferred, merge,
 * once, scroll) can be expressed and freely composed.
 */

import type { LiveChannel, LiveListener, LivePropMetadata, ScrollMetadata } from './types.js'

export type { LiveChannel, LiveListener, LivePropMetadata, ScrollMetadata }

/** An event class: any class with a static `eventName`, which is what the client listens for. */
export type LiveEventClass = (abstract new (...args: any[]) => unknown) & { readonly eventName: string }

/** An event a live prop listens for: its literal name, or a class with a static `eventName`. */
export type LiveEvent = string | LiveEventClass

/**
 * A channel: a bare name (a public channel, as in Laravel), or a name and a
 * type, e.g. `{ name: 'orders.1', type: 'private' }`. Names are unprefixed.
 */
export type LiveChannelInput = string | LiveChannel

export interface LiveOptions {
  /** The event, or events, that refresh the prop. At least one is required. */
  on: LiveEvent | LiveEvent[]
  /** The channel, or channels, those events arrive on. */
  channel?: LiveChannelInput | LiveChannelInput[]
  /** Milliseconds between reloads of the prop. Defaults to the client's. */
  throttle?: number
}

export type Resolvable<T> = T | Promise<T> | (() => T | Promise<T>)

/** Implemented by values (e.g. paginators) that can describe their own cursor. */
export interface ProvidesScrollMetadata {
  toScrollMetadata(): ScrollMetadata
}

export abstract class Prop {
  /** Resolves the prop to its final value. */
  abstract resolve(): Promise<unknown>
}

/** Calls functions and awaits promises, leaving any other value untouched. */
export async function resolveCallable(value: unknown): Promise<unknown> {
  if (value instanceof Prop) {
    return value.resolve()
  }

  return typeof value === 'function' ? await value() : await value
}

type PropConstructor<T = Prop> = abstract new (...args: any[]) => T

const DEFERRABLE = Symbol('inertia.deferrable')
const MERGEABLE = Symbol('inertia.mergeable')
const ONCEABLE = Symbol('inertia.onceable')
const RESCUABLE = Symbol('inertia.rescuable')
const IGNORE_FIRST_LOAD = Symbol('inertia.ignoreFirstLoad')
const LIVE = Symbol('inertia.live')

const MERGE_CANNOT_BE_LIVE = 'Live updates are not supported on merge properties.'

interface LiveDeclaration {
  events: LiveEvent[]
  channels: LiveChannelInput[]
}

interface LiveState {
  live: boolean
  /** One entry per `live()` call, so an explicit channel only applies to its own events. */
  declarations: LiveDeclaration[]
  throttle: number | null
}

interface DeferState {
  deferred: boolean
  group: string | null
}

interface MergeState {
  merging: boolean
  deepMerging: boolean
  matchOn: string[]
  appending: boolean
  appendPaths: string[]
  prependPaths: string[]
}

interface OnceState {
  resolveOnce: boolean
  refresh: boolean
  key: string | null
  expiry: { ttlSeconds: number } | { at: Date } | null
}

// Mixin state lives under module-private symbols: it stays out of the public
// API (and editor completions) while remaining expressible in declaration files.

export interface DeferrableProp extends Prop {
  readonly [DEFERRABLE]: DeferState
  defer(group?: string | null): this
  shouldDefer(): boolean
  group(): string
}

export interface MergeableProp extends Prop {
  readonly [MERGEABLE]: MergeState
  merge(): this
  deepMerge(): this
  matchOn(matchOn: string | string[]): this
  append(path?: boolean | string | string[] | Record<string, string>, matchOn?: string): this
  prepend(path?: boolean | string | string[] | Record<string, string>, matchOn?: string): this
  shouldMerge(): boolean
  shouldDeepMerge(): boolean
  matchesOn(): string[]
  appendsAtRoot(): boolean
  prependsAtRoot(): boolean
  appendsAtPaths(): string[]
  prependsAtPaths(): string[]
}

export interface OnceableProp extends Prop {
  readonly [ONCEABLE]: OnceState
  once(value?: boolean, options?: { as?: string; until?: number | Date }): this
  as(key: string): this
  fresh(value?: boolean): this
  until(delay: number | Date): this
  shouldResolveOnce(): boolean
  shouldBeRefreshed(): boolean
  getKey(): string | null
  expiresAt(): number | null
}

export interface RescuableProp extends Prop {
  readonly [RESCUABLE]: true
  shouldRescue(): boolean
}

/** Props that are never part of a full (non-partial) visit. */
export interface IgnoreFirstLoadProp extends Prop {
  readonly [IGNORE_FIRST_LOAD]: true
}

/** Props that can be refreshed by events (`SupportsLiveUpdates` in inertia-laravel). */
export interface LiveableProp extends Prop {
  readonly [LIVE]: LiveState
  live(options: LiveOptions): this
  isLive(): boolean
  liveListeners(): LiveListener[]
  liveThrottle(): number | null
}

export const isDeferrable = (value: unknown): value is DeferrableProp =>
  value instanceof Prop && DEFERRABLE in value
export const isMergeable = (value: unknown): value is MergeableProp =>
  value instanceof Prop && MERGEABLE in value
export const isOnceable = (value: unknown): value is OnceableProp =>
  value instanceof Prop && ONCEABLE in value
export const isRescuable = (value: unknown): value is RescuableProp =>
  value instanceof Prop && RESCUABLE in value
export const ignoresFirstLoad = (value: unknown): value is IgnoreFirstLoadProp =>
  value instanceof Prop && IGNORE_FIRST_LOAD in value
export const supportsLiveUpdates = (value: unknown): value is LiveableProp =>
  value instanceof Prop && LIVE in value
/** The prop was marked live, so it announces its listeners under `liveProps`. */
export const isLive = (value: unknown): value is LiveableProp => supportsLiveUpdates(value) && value.isLive()

function Deferrable<TBase extends PropConstructor>(Base: TBase) {
  abstract class Deferrable extends Base implements DeferrableProp {
    readonly [DEFERRABLE]: DeferState = { deferred: false, group: null }

    /** Exclude the prop from the initial visit and load it in a follow-up request. */
    defer(group: string | null = null): this {
      this[DEFERRABLE].deferred = true
      this[DEFERRABLE].group = group
      return this
    }

    shouldDefer(): boolean {
      return this[DEFERRABLE].deferred
    }

    group(): string {
      return this[DEFERRABLE].group ?? 'default'
    }
  }

  return Deferrable
}

function Mergeable<TBase extends PropConstructor>(Base: TBase) {
  abstract class Mergeable extends Base implements MergeableProp {
    readonly [MERGEABLE]: MergeState = {
      merging: false,
      deepMerging: false,
      matchOn: [],
      appending: true,
      appendPaths: [],
      prependPaths: [],
    }

    /** Merge the incoming value with the client's value instead of replacing it. */
    merge(): this {
      // Guarded from both sides, since the order the two are called in is the author's to choose.
      if (isLive(this)) {
        throw new Error(MERGE_CANNOT_BE_LIVE)
      }

      this[MERGEABLE].merging = true
      return this
    }

    /** Recursively merge nested objects and arrays. */
    deepMerge(): this {
      this[MERGEABLE].deepMerging = true
      return this.merge()
    }

    /** Fields used to match (and update in place) existing items while merging. */
    matchOn(matchOn: string | string[]): this {
      this[MERGEABLE].matchOn = Array.isArray(matchOn) ? [...matchOn] : [matchOn]
      return this
    }

    /**
     * Append at the root (`true`), at a nested path (`'data'`), at several
     * paths (`['data', 'meta.items']`), or at paths with match keys
     * (`{ data: 'id' }`).
     */
    append(path: boolean | string | string[] | Record<string, string> = true, matchOn?: string): this {
      const state = this[MERGEABLE]

      if (typeof path === 'boolean') {
        state.appending = path
      } else if (typeof path === 'string') {
        state.appendPaths.push(path)
        if (matchOn) state.matchOn = [...state.matchOn, `${path}.${matchOn}`]
      } else if (Array.isArray(path)) {
        path.forEach((item) => this.append(item))
      } else {
        Object.entries(path).forEach(([key, match]) => this.append(key, match))
      }

      return this
    }

    /** Prepend at the root or at nested paths. Accepts the same arguments as `append()`. */
    prepend(path: boolean | string | string[] | Record<string, string> = true, matchOn?: string): this {
      const state = this[MERGEABLE]

      if (typeof path === 'boolean') {
        state.appending = !path
      } else if (typeof path === 'string') {
        state.prependPaths.push(path)
        if (matchOn) state.matchOn = [...state.matchOn, `${path}.${matchOn}`]
      } else if (Array.isArray(path)) {
        path.forEach((item) => this.prepend(item))
      } else {
        Object.entries(path).forEach(([key, match]) => this.prepend(key, match))
      }

      return this
    }

    shouldMerge(): boolean {
      return this[MERGEABLE].merging
    }

    shouldDeepMerge(): boolean {
      return this[MERGEABLE].deepMerging
    }

    matchesOn(): string[] {
      return this[MERGEABLE].matchOn
    }

    appendsAtRoot(): boolean {
      return this[MERGEABLE].appending && mergesAtRoot(this[MERGEABLE])
    }

    prependsAtRoot(): boolean {
      return !this[MERGEABLE].appending && mergesAtRoot(this[MERGEABLE])
    }

    appendsAtPaths(): string[] {
      return this[MERGEABLE].appendPaths
    }

    prependsAtPaths(): string[] {
      return this[MERGEABLE].prependPaths
    }
  }

  return Mergeable
}

function mergesAtRoot(state: MergeState): boolean {
  return state.appendPaths.length === 0 && state.prependPaths.length === 0
}

function Onceable<TBase extends PropConstructor>(Base: TBase) {
  abstract class Onceable extends Base implements OnceableProp {
    readonly [ONCEABLE]: OnceState = { resolveOnce: false, refresh: false, key: null, expiry: null }

    /** Resolve the prop once and let the client reuse it on subsequent visits. */
    once(value = true, options: { as?: string; until?: number | Date } = {}): this {
      this[ONCEABLE].resolveOnce = value
      if (options.as !== undefined) this.as(options.as)
      if (options.until !== undefined) this.until(options.until)
      return this
    }

    /** Share the remembered value across pages under a custom key. */
    as(key: string): this {
      this[ONCEABLE].key = key
      return this
    }

    /** Force a fresh value even when the client already holds one. */
    fresh(value = true): this {
      this[ONCEABLE].refresh = value
      return this
    }

    /** Expire the remembered value after a number of seconds or at a given date. */
    until(delay: number | Date): this {
      this[ONCEABLE].expiry = delay instanceof Date ? { at: delay } : { ttlSeconds: delay }
      return this
    }

    shouldResolveOnce(): boolean {
      return this[ONCEABLE].resolveOnce
    }

    shouldBeRefreshed(): boolean {
      return this[ONCEABLE].refresh
    }

    getKey(): string | null {
      return this[ONCEABLE].key
    }

    /** The expiration timestamp in milliseconds, or `null` when it never expires. */
    expiresAt(): number | null {
      const { expiry } = this[ONCEABLE]

      if (expiry === null) return null
      if ('at' in expiry) return expiry.at.getTime()

      return (Math.floor(Date.now() / 1000) + expiry.ttlSeconds) * 1000
    }
  }

  return Onceable
}

/** A port of inertia-laravel's `HasLiveUpdates`: its output and error messages match. */
function Live<TBase extends PropConstructor>(Base: TBase) {
  abstract class Live extends Base implements LiveableProp {
    readonly [LIVE]: LiveState = { live: false, declarations: [], throttle: null }

    /**
     * Refresh the prop with a partial reload whenever one of the given events
     * arrives on one of the given channels. May be called more than once; each
     * call's channels apply only to its own events. Merge props can't be live.
     */
    live(options: LiveOptions): this {
      if (isMergeable(this) && this.shouldMerge()) {
        throw new Error(MERGE_CANNOT_BE_LIVE)
      }

      const state = this[LIVE]
      state.live = true
      state.declarations.push({ events: wrap(options.on), channels: wrap(options.channel) })

      if (options.throttle !== undefined) {
        state.throttle = options.throttle
      }

      return this
    }

    isLive(): boolean {
      return this[LIVE].live
    }

    liveThrottle(): number | null {
      return this[LIVE].throttle
    }

    /** The listeners announced under `liveProps`, one per channel, events in declaration order. */
    liveListeners(): LiveListener[] {
      const { declarations } = this[LIVE]

      if (!declarations.some((declaration) => declaration.events.length > 0)) {
        throw new Error('A live property must listen for at least one event. Pass the event to the [on] argument.')
      }

      const listeners = new Map<string, LiveListener>()

      for (const declaration of declarations) {
        for (const event of declaration.events) {
          const eventName = resolveEventName(event)

          if (declaration.channels.length === 0) {
            throw new Error(missingChannelMessage(event))
          }

          for (const input of declaration.channels) {
            const channel = resolveChannel(input)
            const key = `${channel.type}:${channel.name}`
            const listener = listeners.get(key) ?? { channel, events: [] }

            if (!listener.events.includes(eventName)) {
              listener.events.push(eventName)
            }

            listeners.set(key, listener)
          }
        }
      }

      return [...listeners.values()]
    }
  }

  return Live
}

function wrap<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []

  return Array.isArray(value) ? [...value] : [value]
}

function resolveEventName(event: LiveEvent): string {
  if (typeof event === 'string') {
    return event
  }

  if (typeof event.eventName !== 'string' || event.eventName === '') {
    throw new Error(
      `The [${event.name}] event class does not define a static [eventName]. ` +
        'Pass an event class with a static [eventName], or its event name as a string.',
    )
  }

  return event.eventName
}

/**
 * Laravel reads an event's channels off its `broadcastOn()`. A JavaScript
 * class can't be built without its payload safely, so channels are always
 * passed explicitly; the message keeps Laravel's wording.
 */
function missingChannelMessage(event: LiveEvent): string {
  const [name, kind] = typeof event === 'string' ? [event, 'a string'] : [event.name, 'a class']

  return `Unable to resolve the channels for the [${name}] event because it was given as ${kind}. Pass the [channel] argument.`
}

/** A bare string is a public channel, as in Laravel. Names are used as given, never prefixed. */
function resolveChannel(channel: LiveChannelInput): LiveChannel {
  return typeof channel === 'string' ? { name: channel, type: 'public' } : { name: channel.name, type: channel.type }
}

/** Always included, even when a partial reload filters it out. */
export class AlwaysProp extends Live(Prop) {
  constructor(protected readonly value: unknown) {
    super()
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.value)
  }
}

/** Never included on full visits; only resolved when a partial reload asks for it. */
export class OptionalProp extends Live(Onceable(Prop)) implements IgnoreFirstLoadProp {
  readonly [IGNORE_FIRST_LOAD] = true as const

  constructor(protected readonly callback: () => unknown) {
    super()
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.callback)
  }
}

/** Announced on full visits and loaded by the client in a follow-up request. */
export class DeferProp
  extends Live(Onceable(Mergeable(Deferrable(Prop))))
  implements IgnoreFirstLoadProp, RescuableProp
{
  readonly [IGNORE_FIRST_LOAD] = true as const
  readonly [RESCUABLE] = true as const

  constructor(
    protected readonly callback: () => unknown,
    group: string | null = null,
    protected readonly rescue = false,
  ) {
    super()
    this.defer(group)
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.callback)
  }

  shouldRescue(): boolean {
    return this.rescue
  }
}

/** Merged into the client's existing value on partial reloads. */
export class MergeProp extends Onceable(Mergeable(Prop)) {
  constructor(protected readonly value: unknown) {
    super()
    this.merge()
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.value)
  }
}

/** Resolved once, then remembered by the client across visits. */
export class OnceProp extends Live(Onceable(Prop)) {
  constructor(protected readonly callback: () => unknown) {
    super()
    this.once()
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.callback)
  }
}

/**
 * Refreshed with a partial reload whenever one of its events arrives. Pass a
 * closure so a reload of other props never runs this one's query.
 */
export class LiveProp extends Live(Prop) {
  constructor(
    protected readonly value: unknown,
    options: LiveOptions,
  ) {
    super()
    this.live(options)
  }

  resolve(): Promise<unknown> {
    return resolveCallable(this.value)
  }
}

/** A paginated prop for the `<InfiniteScroll>` component. */
export class ScrollProp<T = unknown> extends Mergeable(Deferrable(Prop)) {
  private resolved: { value: T } | null = null

  constructor(
    protected readonly value: Resolvable<T>,
    protected readonly wrapper = 'data',
    protected readonly metadataProvider: ScrollMetadata | ((value: T) => ScrollMetadata) | null = null,
  ) {
    super()
    this.merge()
  }

  /**
   * The `<InfiniteScroll>` component announces whether it is loading the
   * previous or the next page, so the server doesn't need to know direction.
   */
  configureMergeIntent(intent: string | undefined): this {
    return intent === 'prepend' ? this.prepend(this.wrapper) : this.append(this.wrapper)
  }

  async metadata(): Promise<ScrollMetadata> {
    const provider = this.metadataProvider

    if (provider !== null && typeof provider !== 'function') {
      return pickScrollMetadata(provider)
    }

    const value = await this.resolve()

    if (typeof provider === 'function') {
      return pickScrollMetadata(provider(value))
    }

    if (isScrollMetadataProvider(value)) {
      return pickScrollMetadata(value.toScrollMetadata())
    }

    throw new TypeError(
      'The scroll prop value does not provide scroll metadata. Return a paginator implementing ' +
        '`toScrollMetadata()` or pass a metadata callback to `Inertia.scroll()`.',
    )
  }

  async resolve(): Promise<T> {
    if (this.resolved === null) {
      this.resolved = { value: (await resolveCallable(this.value)) as T }
    }

    return this.resolved.value
  }
}

function isScrollMetadataProvider(value: unknown): value is ProvidesScrollMetadata {
  return typeof (value as ProvidesScrollMetadata | null)?.toScrollMetadata === 'function'
}

function pickScrollMetadata({ pageName, previousPage, nextPage, currentPage }: ScrollMetadata): ScrollMetadata {
  return { pageName, previousPage, nextPage, currentPage }
}

/** Determine if the value carries prop-type semantics the resolver must honour. */
export function isPropType(value: unknown): value is Prop {
  return (
    value instanceof AlwaysProp ||
    isDeferrable(value) ||
    ignoresFirstLoad(value) ||
    isMergeable(value) ||
    isOnceable(value) ||
    supportsLiveUpdates(value)
  )
}

/** Factories mirroring `Inertia::always()`, `Inertia::defer()`, etc. */
export const props = {
  live: (value: unknown, options: LiveOptions) => new LiveProp(value, options),
  always: (value: unknown) => new AlwaysProp(value),
  optional: (callback: () => unknown) => new OptionalProp(callback),
  defer: (callback: () => unknown, group: string | null = null, options: { rescue?: boolean } = {}) =>
    new DeferProp(callback, group, options.rescue ?? false),
  merge: (value: unknown) => new MergeProp(value),
  deepMerge: (value: unknown) => new MergeProp(value).deepMerge(),
  once: (callback: () => unknown) => new OnceProp(callback),
  scroll: <T>(
    value: Resolvable<T>,
    options: { wrapper?: string; metadata?: ScrollMetadata | ((value: T) => ScrollMetadata) } = {},
  ) => new ScrollProp<T>(value, options.wrapper ?? 'data', options.metadata ?? null),
}
