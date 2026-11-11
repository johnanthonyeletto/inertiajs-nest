import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { User } from '../database/models/index.js'

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
  }
}

export class UnauthenticatedException extends HttpException {
  constructor() {
    super('Unauthenticated.', HttpStatus.UNAUTHORIZED)
  }
}

/** Loads the signed-in user from the session. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
    const userId = request.session.userId

    if (userId) {
      request.user = (await User.findByPk(userId)) ?? undefined
    }

    next()
  }
}

/** Requires a signed-in user; guests are redirected to the login page. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()

    if (!request.user) {
      if (request.method === 'GET' && !request.get('X-Inertia-Partial-Component')) {
        request.session.intendedUrl = request.originalUrl
      }

      throw new UnauthenticatedException()
    }

    return true
  }
}
