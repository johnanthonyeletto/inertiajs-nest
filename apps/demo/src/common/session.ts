import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import session, { type SessionData } from 'express-session'
import { Op } from 'sequelize'
import { Session } from '../database/models/index.js'

declare module 'express-session' {
  interface SessionData {
    userId?: number
    csrfToken?: string
    intendedUrl?: string
    assetVersionSalt?: string
    mergeDemo?: { team: number; conversation: number }
  }
}

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 2

/** An `express-session` store persisting sessions in the database via Sequelize. */
export class SequelizeSessionStore extends session.Store {
  private lastPrunedAt = 0

  override get(sid: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    Session.findByPk(sid)
      .then((row) => callback(null, row && row.expiresAt > new Date() ? (JSON.parse(row.data) as SessionData) : null))
      .catch(callback)
  }

  override set(sid: string, data: SessionData, callback?: (error?: unknown) => void): void {
    Session.upsert({ sid, data: JSON.stringify(data), expiresAt: expiresAt(data) })
      .then(() => this.prune())
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error))
  }

  override touch(sid: string, data: SessionData, callback?: () => void): void {
    Session.update({ expiresAt: expiresAt(data) }, { where: { sid } })
      .then(() => callback?.())
      .catch(() => callback?.())
  }

  override destroy(sid: string, callback?: (error?: unknown) => void): void {
    Session.destroy({ where: { sid } })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error))
  }

  /** Remove expired sessions, at most once a minute. */
  private async prune(): Promise<void> {
    if (Date.now() - this.lastPrunedAt < 60_000) return

    this.lastPrunedAt = Date.now()
    await Session.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } })
  }
}

function expiresAt(data: SessionData): Date {
  return data.cookie?.expires ? new Date(data.cookie.expires) : new Date(Date.now() + SESSION_LIFETIME_MS)
}

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private readonly handler: RequestHandler = session({
    store: new SequelizeSessionStore(),
    name: 'inertia_nest_session',
    secret: process.env.APP_KEY ?? 'insecure-development-key-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SESSION_SECURE_COOKIE === 'true',
      maxAge: SESSION_LIFETIME_MS,
    },
  })

  use(request: Request, response: Response, next: NextFunction): void {
    this.handler(request, response, next)
  }
}

/** Regenerate the session id (e.g. on login/logout) to prevent session fixation. */
export function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.regenerate((error) => (error ? reject(error) : resolve())))
}
