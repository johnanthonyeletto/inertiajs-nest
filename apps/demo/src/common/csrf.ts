import { randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpException, Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
export const CSRF_COOKIE = 'XSRF-TOKEN'

export class CsrfTokenMismatchException extends HttpException {
  constructor() {
    super('CSRF token mismatch.', 419)
  }
}

/**
 * Double-submit CSRF protection compatible with the Inertia client, which
 * reads the `XSRF-TOKEN` cookie and echoes it in the `X-XSRF-TOKEN` header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const token = ensureCsrfToken(request, response)

    if (!SAFE_METHODS.includes(request.method)) {
      const supplied =
        request.get('X-XSRF-TOKEN') ?? request.get('X-CSRF-TOKEN') ?? (request.body as { _token?: unknown })?._token

      if (typeof supplied !== 'string' || !safeEquals(supplied, token)) {
        throw new CsrfTokenMismatchException()
      }
    }

    next()
  }
}

/** Ensure the session has a CSRF token and expose it to the client. */
export function ensureCsrfToken(request: Request, response: Response): string {
  request.session.csrfToken ??= randomBytes(32).toString('base64url')
  response.cookie(CSRF_COOKIE, request.session.csrfToken, {
    sameSite: 'lax',
    secure: request.secure,
    path: '/',
  })

  return request.session.csrfToken
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  return left.length === right.length && timingSafeEqual(left, right)
}
