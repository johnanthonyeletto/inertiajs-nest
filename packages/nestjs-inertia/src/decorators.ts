import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { Request } from 'express'
import { ENCRYPT_HISTORY_METADATA, PRECOGNITIVE_METADATA } from './constants.js'
import type { InertiaContext } from './context.js'
import { props } from './props.js'
import { currentRequest } from './request-context.js'
import { PrecognitionSuccessException } from './validation.js'

const InertiaParam = createParamDecorator((_data: unknown, context: ExecutionContext): InertiaContext => {
  const inertia = context.switchToHttp().getRequest<Request>().inertia

  if (!inertia) {
    throw new Error('No Inertia context found. Is InertiaMiddleware (or a subclass) applied to this route?')
  }

  return inertia
})

/**
 * Injects the request's `InertiaContext`, and doubles as the namespace for
 * prop factories, mirroring Laravel's `Inertia` facade:
 *
 * ```ts
 * show(@Inertia() inertia: InertiaContext) {
 *   return inertia.render('Users/Show', { stats: Inertia.defer(() => loadStats()) })
 * }
 * ```
 */
export const Inertia = Object.assign(InertiaParam, props)

type Handler = (this: unknown, ...args: unknown[]) => unknown

const WRAPPED = Symbol('inertia.precognitive')

/**
 * Wraps a route handler so it never runs for a Precognition request: once
 * the request has passed every guard and pipe (i.e. validation succeeded),
 * it is answered with `204 Precognition-Success` instead.
 */
function guardHandler(handler: Handler): Handler {
  if (isPrecognitionGuarded(handler)) {
    return handler
  }

  const wrapper = function (this: unknown, ...args: unknown[]) {
    if (currentRequest()?.precognitive) {
      throw new PrecognitionSuccessException()
    }

    return handler.apply(this, args)
  }

  // Keep the metadata other decorators (e.g. `@Post()`) already attached.
  for (const key of Reflect.getOwnMetadataKeys(handler)) {
    Reflect.defineMetadata(key, Reflect.getOwnMetadata(key, handler), wrapper)
  }

  Object.defineProperty(wrapper, 'name', { value: handler.name })
  Object.defineProperty(wrapper, WRAPPED, { value: true })

  return wrapper
}

/** Whether a handler is guarded by `@Precognitive()` and so never runs for Precognition requests. */
export function isPrecognitionGuarded(handler: unknown): boolean {
  return typeof handler === 'function' && (handler as Handler & { [WRAPPED]?: true })[WRAPPED] === true
}

/**
 * Opt a route (or every route of a controller) into Precognition: requests
 * carrying `Precognition: true` run guards and pipes (validating the body
 * DTO), then are answered without running the handler — `204` when
 * validation passes, `422` with the errors when it doesn't.
 */
export function Precognitive(): MethodDecorator & ClassDecorator {
  return ((target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      descriptor.value = guardHandler(descriptor.value as Handler)
      SetMetadata(PRECOGNITIVE_METADATA, true)(target, key!, descriptor)

      return descriptor
    }

    const prototype = (target as { prototype: object }).prototype
    const seen = new Set<string>(['constructor'])

    // Guard the class's own handlers and the ones it inherits. Inherited
    // handlers are guarded with an own (shadowing) property, so the base
    // class and its other subclasses are left untouched.
    for (let current = prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
      for (const name of Object.getOwnPropertyNames(current)) {
        if (seen.has(name)) continue
        seen.add(name)

        const method = Object.getOwnPropertyDescriptor(current, name)

        if (typeof method?.value === 'function') {
          Object.defineProperty(prototype, name, { ...method, value: guardHandler(method.value as Handler) })
        }
      }
    }

    SetMetadata(PRECOGNITIVE_METADATA, true)(target as never)
  }) as MethodDecorator & ClassDecorator
}

/** Encrypt the history state of pages rendered by a route or controller. */
export const EncryptHistory = (encrypt = true) => SetMetadata(ENCRYPT_HISTORY_METADATA, encrypt)
