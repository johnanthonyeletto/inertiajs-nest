import { randomBytes } from 'node:crypto'
import { Body, Controller, Get, HttpException, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { IsIn } from 'class-validator'
import type { Request } from 'express'
import { AuthGuard } from '../auth/auth.js'
import { now, randomInt, sleep } from '../common/time.js'
import { Contact } from '../database/models/index.js'
import { Inertia, type InertiaContext } from 'inertia-nest'

class FlashDto {
  @IsIn(['success', 'error', 'warning'])
  type: 'success' | 'error' | 'warning'
}

const FLASH_MESSAGES = {
  success: 'Everything worked out!',
  error: 'Something went wrong.',
  warning: 'Please double-check your input.',
}

@Controller('features')
@UseGuards(AuthGuard)
export class PrefetchingController {
  @Get('prefetching')
  prefetching(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Prefetching/Index', { timestamp: now() })
  }

  @Get('prefetching/pages/:id')
  async target(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    await sleep(800)

    return inertia.render('Features/Prefetching/Target', { id, timestamp: now(), value: randomInt(1, 1000) })
  }
}

@Controller('features/state')
@UseGuards(AuthGuard)
export class StateController {
  @Get('remember')
  remember(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/State/Remember')
  }

  @Get('flash')
  flash(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/State/Flash', { timestamp: now() })
  }

  @Post('flash')
  storeFlash(@Inertia() inertia: InertiaContext, @Body() body: FlashDto) {
    return inertia
      .flash('toast', { type: body.type, message: FLASH_MESSAGES[body.type] })
      .flash('highlight', randomInt(1, 6))
      .back()
  }

  @Get('shared-props')
  sharedProps(@Inertia() inertia: InertiaContext) {
    // Shared from a controller: merged into this response's props only.
    inertia.share('controllerShared', { message: 'Shared via inertia.share() in the controller', at: now() })
    inertia.shareOnce('favoritesCount', () => Contact.count({ where: { isFavorite: true } }))

    return inertia.render('Features/State/SharedProps')
  }
}

@Controller('features/layouts')
@UseGuards(AuthGuard)
export class LayoutsController {
  @Get('persistent')
  persistent(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Layouts/Persistent', { page: 1 })
  }

  @Get('persistent/2')
  persistentTwo(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Layouts/Persistent', { page: 2 })
  }

  @Get('head')
  head(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Layouts/Head', { timestamp: now() })
  }
}

@Controller('features/events')
@UseGuards(AuthGuard)
export class EventsController {
  @Get()
  events(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Events/Index', { timestamp: now() })
  }

  @Get('slow')
  async slow(@Inertia() inertia: InertiaContext) {
    await sleep(2000)

    return inertia.render('Features/Events/Index', { timestamp: now() })
  }

  @Post('action')
  action(@Inertia() inertia: InertiaContext) {
    return inertia.flash('toast', { type: 'success', message: 'Action completed.' }).back()
  }
}

@Controller('features/errors')
@UseGuards(AuthGuard)
export class ErrorsController {
  @Get()
  errors(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Errors/Index')
  }

  @Get('throw/:status')
  throw(@Param('status', ParseIntPipe) status: number) {
    if (status === 500) {
      throw new Error('Something exploded on the server.')
    }

    throw new HttpException(status === 418 ? "I'm a teapot" : `Simulated ${status} error.`, status)
  }

  @Get('asset-version')
  assetVersion(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return inertia.render('Features/Errors/AssetVersion', { salt: request.session.assetVersionSalt ?? null })
  }

  @Post('asset-version/deploy')
  deploy(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    // Changing the version makes the next Inertia GET answer 409 + X-Inertia-Location.
    request.session.assetVersionSalt = randomBytes(4).toString('hex')

    return inertia.flash('toast', { type: 'success', message: 'New version "deployed": the page reloaded with fresh assets.' }).back()
  }
}
