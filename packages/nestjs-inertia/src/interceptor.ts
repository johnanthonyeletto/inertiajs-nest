import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import { mergeMap, type Observable } from 'rxjs'
import { ENCRYPT_HISTORY_METADATA, Header, PRECOGNITIVE_METADATA } from './constants.js'
import { isPrecognitionGuarded } from './decorators.js'
import { markResponseHandled, varyOnSend } from './express.js'
import { currentRequest } from './request-context.js'
import { Responsable } from './responses.js'

/**
 * Sends `Responsable` results (Inertia pages, redirects, location visits),
 * answers stale Inertia GET visits with a version change, and applies
 * `@Precognitive()` and `@EncryptHistory()`. Registered globally by
 * `InertiaModule`.
 */
@Injectable()
export class InertiaInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    const targets = [context.getHandler(), context.getClass()]
    const precognitive = this.reflector.getAllAndOverride<boolean | undefined>(PRECOGNITIVE_METADATA, targets)
    const encryptHistory = this.reflector.getAllAndOverride<boolean | undefined>(ENCRYPT_HISTORY_METADATA, targets)

    // Responses of precognitive routes differ by the Precognition header.
    if (precognitive) {
      varyOnSend(response, Header.PRECOGNITION)
    }

    // The handler itself is guarded by @Precognitive(), so it never runs.
    if (precognitive && request.get(Header.PRECOGNITION) === 'true') {
      if (currentRequest() !== request) {
        throw new Error('@Precognitive() routes require InertiaMiddleware (or a subclass) to be applied.')
      }

      // Fail closed: e.g. @Precognitive() on a base class doesn't reach
      // handlers declared in its subclasses, which would otherwise run.
      if (!isPrecognitionGuarded(context.getHandler())) {
        throw new Error(
          `${context.getClass().name}.${context.getHandler().name}() is precognitive through an inherited ` +
            '@Precognitive() but its handler is not guarded. Apply @Precognitive() to this controller or method.',
        )
      }

      request.precognitive = true
    }

    if (encryptHistory !== undefined) {
      request.inertia?.encryptHistory(encryptHistory)
    }

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        // A stale client must reload to pick up new assets (see InertiaMiddleware.onVersionChange()).
        if (!response.headersSent && (await request.inertia?.handleVersionChange())) {
          markResponseHandled(response)
          return undefined
        }

        if (result instanceof Responsable) {
          await result.toResponse(request, response)
          markResponseHandled(response)

          return undefined
        }

        return result
      }),
    )
  }
}
