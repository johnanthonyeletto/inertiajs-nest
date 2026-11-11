import { type ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import type { Request, Response } from 'express'
import { Header } from './constants.js'
import type { InertiaContext } from './context.js'
import type { Responsable } from './responses.js'
import { describeError, errorStack, isInertiaRequest } from './support.js'
import { PrecognitionSuccessException, ValidationException } from './validation.js'

export interface RenderErrorContext {
  error: unknown
  status: number
  inertia: InertiaContext
  request: Request
}

/**
 * Turns exceptions into protocol-compliant responses:
 *
 * - Precognition: `204` + `Precognition-Success` on success, `422` with errors on failure.
 * - Validation errors on Inertia visits and form posts: flash the errors and redirect back.
 * - Anything else on Inertia visits and page loads: `renderError()`, e.g. an Inertia error page.
 *
 * Everything else, including every API (JSON) request, is handed to Nest's
 * default exception handling. Register it globally:
 *
 * ```ts
 * providers: [{ provide: APP_FILTER, useClass: InertiaExceptionFilter }]
 * ```
 *
 * or extend it to render error pages:
 *
 * ```ts
 * @Catch()
 * export class AppExceptionFilter extends InertiaExceptionFilter {
 *   renderError({ status, inertia }: RenderErrorContext) {
 *     if ([403, 404, 500, 503].includes(status)) {
 *       return inertia.render('Error', { status }).status(status)
 *     }
 *   }
 * }
 * ```
 */
@Catch()
export class InertiaExceptionFilter extends BaseExceptionFilter {
  protected readonly logger = new Logger('ExceptionsHandler')

  /**
   * Render a response for an exception on an Inertia visit or page load.
   * Return `undefined` to fall back to Nest's default handling.
   */
  renderError(_context: RenderErrorContext): Responsable | undefined | Promise<Responsable | undefined> {
    return undefined
  }

  override async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    if (host.getType() !== 'http') {
      return super.catch(exception, host)
    }

    const response = host.switchToHttp().getResponse<Response>()

    // Nest doesn't await filters, so nothing may escape from here: a failure
    // (e.g. a throwing `version()`) falls back to Nest's default handling.
    try {
      await this.respond(exception, host)
    } catch (error) {
      this.logger.error(`Failed to handle an exception: ${describeError(error)}`, errorStack(error))

      if (!response.headersSent) {
        super.catch(exception, host)
      }
    }
  }

  private async respond(exception: unknown, host: ArgumentsHost): Promise<void> {
    const request = host.switchToHttp().getRequest<Request>()
    const response = host.switchToHttp().getResponse<Response>()

    if (response.headersSent) {
      return
    }

    if (request.precognitive) {
      response.set(Header.PRECOGNITION, 'true')

      if (exception instanceof PrecognitionSuccessException) {
        response.set(Header.PRECOGNITION_SUCCESS, 'true').status(HttpStatus.NO_CONTENT).end()
        return
      }

      if (exception instanceof ValidationException) {
        response.status(exception.getStatus()).json(exception.getResponse())
        return
      }
    }

    if (!request.inertia || !this.expectsPage(request)) {
      return super.catch(exception, host)
    }

    if (exception instanceof ValidationException) {
      await request.inertia.withErrors(exception.errors, exception.errorBag).back().toResponse(request, response)
      return
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    // Error pages are pages too: a stale client must reload first.
    if (await request.inertia.handleVersionChange()) {
      return
    }

    try {
      const rendered = await this.renderError({ error: exception, status, inertia: request.inertia, request })

      if (rendered) {
        if (status >= 500) {
          this.logger.error(describeError(exception), errorStack(exception))
        }

        await rendered.toResponse(request, response)
        return
      }
    } catch (renderError) {
      // Rendering the error page failed too (e.g. a missing build).
      this.logger.error(`Failed to render the error response: ${describeError(renderError)}`, errorStack(renderError))

      if (response.headersSent) {
        return
      }
    }

    return super.catch(exception, host)
  }

  /** Inertia visits and classic page loads and form posts expect a page or redirect; API calls expect JSON. */
  protected expectsPage(request: Request): boolean {
    return isInertiaRequest(request) || request.accepts(['html', 'json']) !== 'json'
  }
}
