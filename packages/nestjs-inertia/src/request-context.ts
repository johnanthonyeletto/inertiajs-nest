import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response } from 'express'

interface RequestStore {
  request: Request
  response: Response
}

const storage = new AsyncLocalStorage<RequestStore>()

/** Run `callback` with `request` available to `currentRequest()`. Used by `InertiaMiddleware`. */
export function runWithRequest<T>(request: Request, response: Response, callback: () => T): T {
  return storage.run({ request, response }, callback)
}

/**
 * The request being handled, for code Nest doesn't hand it to (pipes,
 * exception factories). `undefined` outside `InertiaMiddleware`.
 */
export function currentRequest(): Request | undefined {
  return storage.getStore()?.request
}
