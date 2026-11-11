export { isInertiaRequest } from './express.js'

/** Field → one message or several, as accepted when failing validation manually. */
export type ErrorMessages = Record<string, string | string[]>

/** Field (dot-notation) → messages. */
export type ValidationErrors = Record<string, string[]>

/** Normalize every field's message(s) to an array. */
export function normalizeErrorMessages(messages: ErrorMessages): ValidationErrors {
  return Object.fromEntries(
    Object.entries(messages).map(([field, message]) => [field, Array.isArray(message) ? message : [message]]),
  )
}

/** Plain objects and arrays are traversed; class instances are leaf values. */
export function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true
  if (value === null || typeof value !== 'object') return false

  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

/** A shallow copy of a container, so it can be written to without touching the original. */
export function copyContainer<T extends Record<string, unknown> | unknown[]>(container: T): T {
  return (Array.isArray(container) ? [...container] : { ...container }) as T
}

/**
 * Mirrors `Arr::set`: assigns `value` at a dot-notation path, creating (or
 * replacing non-container) intermediate segments. Containers along the path
 * are copied rather than written to, so objects the caller passed in (e.g.
 * returned by the `share` option and reused across requests) are never mutated.
 */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.')
  let current = target

  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]

    current[segment] = isContainer(next) ? copyContainer(next) : {}
    current = current[segment] as Record<string, unknown>
  }

  current[segments[segments.length - 1]] = value
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined
}
