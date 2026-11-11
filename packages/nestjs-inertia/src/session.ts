import type { Request } from 'express'

/** Inertia state persisted between requests. */
export interface InertiaSessionData {
  /** Data flashed to the next rendered page. */
  flash?: Record<string, unknown>
  /** Validation errors by error bag, then field. */
  errors?: Record<string, Record<string, string[]>>
  /** Clear encrypted history state on the next rendered page. */
  clearHistory?: boolean
  /** Keep the URL fragment across the next redirect. */
  preserveFragment?: boolean
}

/** Per-request access to wherever Inertia's one-time state is kept. */
export interface InertiaSession {
  get<K extends keyof InertiaSessionData>(key: K): InertiaSessionData[K] | undefined
  /** Store a value; `undefined` removes it. */
  set<K extends keyof InertiaSessionData>(key: K, value: InertiaSessionData[K] | undefined): void
  /** Read a value and remove it. */
  pull<K extends keyof InertiaSessionData>(key: K): InertiaSessionData[K] | undefined
}

/** Returns the session for a request, or `null` when the request has none. */
export type InertiaSessionResolver = (request: Request) => InertiaSession | null

/** Wraps a plain object (e.g. a session's data) as an `InertiaSession`. */
export function objectSession(store: InertiaSessionData): InertiaSession {
  return {
    get: (key) => store[key],
    set: (key, value) => {
      if (value === undefined) {
        delete store[key]
      } else {
        store[key] = value
      }
    },
    pull: (key) => {
      const value = store[key]
      delete store[key]

      return value
    },
  }
}

/**
 * The default session: Inertia's state is kept under `request.session[key]`,
 * as provided by `express-session` (or any middleware with the same shape,
 * such as `cookie-session`). Apply the session middleware before Inertia's.
 */
export function expressSession(options: { key?: string } = {}): InertiaSessionResolver {
  const key = options.key ?? 'inertia'

  return (request) => {
    const session = (request as Request & { session?: Record<string, unknown> | null }).session

    if (!session) {
      return null
    }

    return lazySession(session, key)
  }
}

/**
 * Reads never write to the session: express-session (with
 * `saveUninitialized: false`) would otherwise save, and set a cookie for,
 * every anonymous visitor. The state object is created on the first write
 * and removed once it's empty again.
 */
function lazySession(session: Record<string, unknown>, key: string): InertiaSession {
  const read = () => session[key] as InertiaSessionData | undefined

  const remove = (name: keyof InertiaSessionData) => {
    const store = read()

    if (store && name in store) {
      delete store[name]
      if (Object.keys(store).length === 0) delete session[key]
    }
  }

  return {
    get: (name) => read()?.[name],
    set: (name, value) => {
      if (value === undefined) {
        remove(name)
      } else {
        ;(((session[key] ??= {}) as InertiaSessionData)[name] as unknown) = value
      }
    },
    pull: (name) => {
      const value = read()?.[name]
      remove(name)

      return value
    },
  }
}
