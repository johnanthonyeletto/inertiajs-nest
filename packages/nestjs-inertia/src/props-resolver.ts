import type { Request } from 'express'
import { Header } from './constants.js'
import {
  AlwaysProp,
  ignoresFirstLoad,
  isDeferrable,
  isMergeable,
  isOnceable,
  isPropType,
  isRescuable,
  Prop,
  resolveCallable,
  ScrollProp,
  type DeferrableProp,
  type MergeableProp,
} from './props.js'
import { copyContainer, isContainer, isInertiaRequest, setPath } from './support.js'
import type { PageMetadata, PageProps, ScrollMetadata } from './types.js'

export type { PageMetadata, PageProps }

export interface PropsResolverOptions {
  /** Emit `sharedProps` so the client can carry shared props over during instant visits. */
  exposeSharedPropKeys?: boolean
  /** Called when a rescued deferred prop throws. */
  onRescue?: (error: unknown, path: string) => void
}

type Container = Record<string, unknown> | unknown[]

/**
 * Resolves page props for a single request and collects the page-object
 * metadata that describes them. A faithful port of the reference adapter's
 * `PropsResolver`, implementing the protocol's prop evaluation model for both
 * full visits and partial reloads.
 */
export class PropsResolver {
  private readonly isPartial: boolean
  private readonly isInertia: boolean
  private readonly only: string[] | null
  private readonly except: string[] | null
  private readonly resetProps: string[]
  private readonly loadedOnceProps: string[]
  private readonly mergeIntent: string | undefined

  private readonly deferredProps: Record<string, string[]> = {}
  private readonly rescuedProps: string[] = []
  private readonly mergeProps: string[] = []
  private readonly prependProps: string[] = []
  private readonly deepMergeProps: string[] = []
  private readonly matchPropsOn: string[] = []
  private readonly scrollProps: Record<string, ScrollMetadata & { reset: boolean }> = {}
  private readonly onceProps: Record<string, { prop: string; expiresAt: number | null }> = {}
  private sharedPropKeys: string[] = []

  constructor(
    request: Request,
    component: string,
    private readonly options: PropsResolverOptions = {},
  ) {
    this.isPartial = request.get(Header.PARTIAL_COMPONENT) === component
    this.isInertia = isInertiaRequest(request)
    this.only = parseHeader(request.get(Header.PARTIAL_ONLY))
    this.except = parseHeader(request.get(Header.PARTIAL_EXCEPT))
    this.resetProps = parseHeader(request.get(Header.RESET)) ?? []
    this.loadedOnceProps = parseHeader(request.get(Header.EXCEPT_ONCE_PROPS)) ?? []
    this.mergeIntent = request.get(Header.INFINITE_SCROLL_MERGE_INTENT)
  }

  /** Resolve the shared and page props, returning the props and the page metadata. */
  async resolve(shared: PageProps, props: PageProps): Promise<[PageProps, PageMetadata]> {
    if (this.options.exposeSharedPropKeys ?? true) {
      this.sharedPropKeys = [...new Set(Object.keys(shared).map((key) => key.split('.')[0]))]
    }

    const unpacked = await this.unpackDotProps({ ...shared, ...props })
    const resolved = (await this.resolveProps(unpacked, '', false)) as PageProps

    return [resolved, this.buildMetadata()]
  }

  private buildMetadata(): PageMetadata {
    const metadata: Record<string, unknown> = {
      sharedProps: this.sharedPropKeys,
      mergeProps: this.mergeProps,
      prependProps: this.prependProps,
      deepMergeProps: this.deepMergeProps,
      matchPropsOn: this.matchPropsOn,
      deferredProps: this.deferredProps,
      rescuedProps: this.rescuedProps,
      scrollProps: this.scrollProps,
      onceProps: this.onceProps,
    }

    return Object.fromEntries(
      Object.entries(metadata).filter(([, value]) =>
        Array.isArray(value) ? value.length > 0 : Object.keys(value as object).length > 0,
      ),
    )
  }

  /** Recursively resolve the props tree, collecting metadata along the way. */
  private async resolveProps(props: Container, prefix: string, parentWasResolved: boolean): Promise<Container> {
    const result: Container = Array.isArray(props) ? [] : {}

    for (const [key, prop] of entries(props)) {
      const path = prefix === '' ? key : `${prefix}.${key}`

      // On partial requests, only props matching the requested paths are
      // included. Always props and children of resolved values bypass this.
      if (!this.shouldIncludeInPartialResponse(prop, path, parentWasResolved)) {
        continue
      }

      // On full visits, some prop types (deferred, optional, already-loaded
      // once props) are excluded before resolution so they never execute.
      if (!this.isPartial && this.excludeFromInitialResponse(prop, path)) {
        continue
      }

      let current: unknown = prop
      let value = await this.resolveValue(current, path)

      if (this.rescuedProps.includes(path)) {
        continue
      }

      // A callback may return a prop type instead of a plain value. Unwrap it
      // one more level so it participates in filtering and metadata.
      if (value !== current && isPropType(value)) {
        current = value

        if (!this.isPartial && this.excludeFromInitialResponse(current, path)) {
          continue
        }

        value = await this.resolveValue(current, path)

        if (this.rescuedProps.includes(path)) {
          continue
        }
      }

      await this.collectMetadata(current, path)

      // Children of a value produced by a callback (rather than a literal
      // object or array) are already resolved, so they bypass partial filtering.
      const resolved = isContainer(value)
        ? await this.resolveProps(value, path, parentWasResolved || !isContainer(prop))
        : value

      if (Array.isArray(result)) {
        result.push(resolved)
      } else {
        result[key] = resolved
      }
    }

    return result
  }

  private shouldIncludeInPartialResponse(prop: unknown, path: string, parentWasResolved: boolean): boolean {
    if (!this.isPartial || prop instanceof AlwaysProp || parentWasResolved) {
      return true
    }

    return this.pathMatchesPartialRequest(path)
  }

  /** Bidirectional prefix matching against the `only` and `except` lists. */
  private pathMatchesPartialRequest(path: string): boolean {
    if (this.only !== null && !this.matchesOnly(path) && !this.leadsToOnly(path)) {
      return false
    }

    if (this.except !== null && this.matchesExcept(path)) {
      return false
    }

    return true
  }

  private excludeFromInitialResponse(prop: unknown, path: string): boolean {
    // Optional and deferred props are never sent on a full visit, but still
    // contribute deferred, merge, and once metadata for the client.
    if (ignoresFirstLoad(prop)) {
      if (isDeferrable(prop) && prop.shouldDefer() && !this.wasAlreadyLoadedByClient(prop, path)) {
        this.collectDeferredPropMetadata(path, prop)
      }

      if (isMergeable(prop) && prop.shouldMerge()) {
        this.collectMergeableMetadata(path, prop)
      }

      if (isOnceable(prop) && prop.shouldResolveOnce()) {
        this.collectOnceMetadata(path, prop)
      }

      return true
    }

    // Scroll props (and other deferrables) may opt into deferring.
    if (isDeferrable(prop) && prop.shouldDefer()) {
      this.collectDeferredPropMetadata(path, prop)

      if (isMergeable(prop) && prop.shouldMerge()) {
        this.collectMergeableMetadata(path, prop)
      }

      return true
    }

    // Once props the client already holds are skipped on subsequent visits.
    if (this.isInertia && this.wasAlreadyLoadedByClient(prop, path)) {
      this.collectOnceMetadata(path, prop)

      return true
    }

    return false
  }

  private wasAlreadyLoadedByClient(prop: unknown, path: string): boolean {
    return (
      isOnceable(prop) &&
      prop.shouldResolveOnce() &&
      !prop.shouldBeRefreshed() &&
      this.loadedOnceProps.includes(prop.getKey() ?? path)
    )
  }

  private async resolveValue(value: unknown, path: string): Promise<unknown> {
    if (value instanceof ScrollProp) {
      value.configureMergeIntent(this.mergeIntent)
    }

    const shouldRescue = isRescuable(value) && value.shouldRescue()

    try {
      // Plain functions and prop types are invoked; promises are awaited.
      const resolved = value instanceof Prop || typeof value === 'function' || isThenable(value)
        ? await resolveCallable(value)
        : value

      return toSerializable(resolved)
    } catch (error) {
      if (!shouldRescue) {
        throw error
      }

      this.options.onRescue?.(error, path)
      this.rescuedProps.push(path)

      return null
    }
  }

  private async collectMetadata(prop: unknown, path: string): Promise<void> {
    if (isMergeable(prop) && prop.shouldMerge()) {
      this.collectMergeableMetadata(path, prop)
    }

    if (prop instanceof ScrollProp) {
      this.scrollProps[path] = {
        ...(await prop.metadata()),
        reset: this.resetProps.includes(path),
      }
    }

    this.collectOnceMetadata(path, prop)
  }

  private collectDeferredPropMetadata(path: string, prop: DeferrableProp): void {
    ;(this.deferredProps[prop.group()] ??= []).push(path)
  }

  private collectMergeableMetadata(path: string, prop: MergeableProp): void {
    // A reset prop is returned unlabeled so the client replaces its value.
    if (this.resetProps.includes(path)) {
      return
    }

    if (this.isPartial && !this.isIncludedInPartialMetadata(path)) {
      return
    }

    if (prop.shouldDeepMerge()) {
      this.deepMergeProps.push(path)
    } else if (prop.appendsAtRoot()) {
      this.mergeProps.push(path)
    } else if (prop.prependsAtRoot()) {
      this.prependProps.push(path)
    } else {
      prop.appendsAtPaths().forEach((appendPath) => this.mergeProps.push(`${path}.${appendPath}`))
      prop.prependsAtPaths().forEach((prependPath) => this.prependProps.push(`${path}.${prependPath}`))
    }

    prop.matchesOn().forEach((strategy) => this.matchPropsOn.push(`${path}.${strategy}`))
  }

  private collectOnceMetadata(path: string, prop: unknown): void {
    if (!isOnceable(prop) || !prop.shouldResolveOnce()) {
      return
    }

    if (this.isPartial && !this.isIncludedInPartialMetadata(path)) {
      return
    }

    this.onceProps[prop.getKey() ?? path] = { prop: path, expiresAt: prop.expiresAt() }
  }

  private isIncludedInPartialMetadata(path: string): boolean {
    if (this.only !== null && !this.matchesOnly(path)) {
      return false
    }

    return !(this.except !== null && this.matchesExcept(path))
  }

  /** The path equals, or is a descendant of, an `only` path. */
  private matchesOnly(path: string): boolean {
    return this.only!.some((only) => path === only || path.startsWith(`${only}.`))
  }

  /** The path is an ancestor of an `only` path. */
  private leadsToOnly(path: string): boolean {
    return this.only!.some((only) => only.startsWith(`${path}.`))
  }

  /** The path equals, or is a descendant of, an `except` path. */
  private matchesExcept(path: string): boolean {
    return this.except!.some((except) => path === except || path.startsWith(`${except}.`))
  }

  /**
   * Unpack top-level dot-notation keys (e.g. `auth.user`) into nested objects.
   * `props` is this request's own (shallow) copy; nested containers are copied
   * before being written to, so shared objects reused across requests stay intact.
   */
  private async unpackDotProps(props: PageProps): Promise<PageProps> {
    for (const key of Object.keys(props)) {
      if (!key.includes('.')) {
        continue
      }

      let value = props[key]

      if (typeof value === 'function') {
        value = await value()
      }

      value = toSerializable(value)

      await this.ensurePathIsTraversable(props, key)
      delete props[key]
      setPath(props, key, value)
    }

    return props
  }

  /** Resolve callbacks along the intermediate segments of a dot-notation key, copying containers on the way. */
  private async ensurePathIsTraversable(props: PageProps, dotKey: string): Promise<void> {
    const segments = dotKey.split('.').slice(0, -1)
    let current: Record<string, unknown> = props

    for (const segment of segments) {
      let next = current[segment]

      if (next === undefined || next === null) {
        return
      }

      if (typeof next === 'function') {
        next = await (next as () => unknown)()
      }

      next = toSerializable(next)
      current[segment] = isContainer(next) ? copyContainer(next) : next

      if (!isContainer(current[segment])) {
        return
      }

      current = current[segment] as Record<string, unknown>
    }
  }
}

function parseHeader(value: string | undefined): string[] | null {
  const items = (value ?? '').split(',').filter((item) => item !== '')

  return items.length > 0 ? items : null
}

function entries(container: Container): [string, unknown][] {
  return Array.isArray(container)
    ? container.map((value, index) => [String(index), value])
    : Object.entries(container)
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function'
}

/** Mirrors `Arrayable`/`JsonSerializable`: objects with `toJSON()` (models, dates) are serialized. */
function toSerializable(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !(value instanceof Prop)) {
    const serializable = value as { toJSON?: () => unknown }

    if (typeof serializable.toJSON === 'function') {
      return serializable.toJSON()
    }
  }

  return value
}
