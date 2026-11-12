import { randomUUID } from 'node:crypto'
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AuthGuard } from '../auth/auth.js'
import { now, randomInt, sleep } from '../common/time.js'
import { serializeContact } from '../crm/serializers.js'
import { Contact, Organization } from '../database/models/index.js'
import { paginate } from '../database/paginator.js'
import { Header, Inertia, type InertiaContext } from '@johnanthonyeletto/nestjs-inertia'

const pick = <T>(items: T[]): T => items[randomInt(0, items.length - 1)]

const TEAM = ['Ada', 'Grace', 'Linus', 'Margaret', 'Ken'].map((name, index) => ({ id: index + 1, name }))

@Controller('features/data')
@UseGuards(AuthGuard)
export class DataController {
  @Get('partial-reloads')
  partialReloads(@Inertia() inertia: InertiaContext) {
    // Closures are only evaluated when the prop is part of the response.
    return inertia.render('Features/Data/PartialReloads', {
      users: () => TEAM.slice(0, 3),
      stats: async () => ({ contacts: await Contact.count(), organizations: await Organization.count() }),
      timestamp: () => now(),
      randomNumber: () => randomInt(1, 1000),
      serverTime: Inertia.always(() => new Date().toISOString()),
    })
  }

  @Get('deferred-props')
  deferredProps(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return inertia.render('Features/Data/DeferredProps', {
      quickStat: 'Rendered with the page',
      slowStats: Inertia.defer(async () => {
        await sleep(800)
        return { contacts: await Contact.count(), favorites: await Contact.count({ where: { isFavorite: true } }) }
      }),
      recentContacts: Inertia.defer(async () => {
        await sleep(1600)
        const contacts = await Contact.findAll({ order: [['createdAt', 'DESC']], limit: 5 })
        return contacts.map(serializeContact)
      }, 'heavy'),
      flakyReport: Inertia.defer(
        async () => {
          await sleep(500)

          if (!request.get('X-Force-Success')) {
            throw new Error('The upstream report service is unavailable.')
          }

          return { value: randomInt(1000, 9999) }
        },
        null,
        { rescue: true },
      ),
    })
  }

  @Get('optional-props')
  optionalProps(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Data/OptionalProps', {
      regularData: { timestamp: now() },
      optionalData: Inertia.optional(async () => {
        await sleep(500)
        const contacts = await Contact.findAll({ limit: 3, order: [['lastName', 'ASC']] })
        return { generatedAt: now(), contacts: contacts.map(serializeContact) }
      }),
      deferredData: Inertia.defer(async () => {
        await sleep(600)
        return { generatedAt: now(), total: await Contact.count() }
      }),
    })
  }

  @Get('merge-props')
  mergeProps(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    // Track how many times each prop was loaded, so every reload returns "more" data.
    const only = (request.get(Header.PARTIAL_ONLY) ?? '').split(',').filter(Boolean)
    const reset = (request.get(Header.RESET) ?? '').split(',')
    const isPartial = inertia.isPartialReloadOf('Features/Data/MergeProps')
    const state = (request.session.mergeDemo ??= { team: 1, conversation: 1 })
    const advance = (prop: 'team' | 'conversation', max = Infinity) => {
      if (!isPartial || reset.includes(prop)) return (state[prop] = 1)
      if (only.length > 0 && !only.includes(prop)) return state[prop]
      return (state[prop] = Math.min(state[prop] + 1, max))
    }
    const step = advance('team', TEAM.length)
    const page = advance('conversation')

    return inertia.render('Features/Data/MergeProps', {
      timestamp: now(),
      // Appended on partial reloads.
      notifications: Inertia.merge([
        { id: randomUUID(), message: `Notification at ${now()}`, level: pick(['info', 'success', 'warning']) },
      ]),
      // Prepended on partial reloads.
      activity: Inertia.merge([
        { id: randomUUID(), action: `${pick(['Created', 'Updated', 'Archived'])} a ${pick(['contact', 'note', 'organization'])}`, at: now() },
      ]).prepend(),
      // Matched on `id`: existing members are updated in place instead of duplicated.
      team: Inertia.merge(TEAM.slice(0, step).map((member) => ({ ...member, seenAt: now() }))).matchOn('id'),
      // Deep merged: nested objects merge, and `messages` are appended (matched on id).
      conversation: Inertia.deepMerge({
        meta: { title: 'Support chat', loadedPages: page, lastLoadedAt: now() },
        messages: [1, 2].map((offset) => {
          const id = (page - 1) * 2 + offset
          return { id, body: `Message #${id}` }
        }),
      }).matchOn('messages.id'),
    })
  }

  @Get('infinite-scroll')
  async infiniteScroll(@Inertia() inertia: InertiaContext, @Req() request: Request, @Query('favorites') favorites?: string) {
    return inertia.render('Features/Data/InfiniteScroll', {
      favorites: favorites === '1',
      contacts: Inertia.scroll(
        paginate(Contact, request, {
          where: favorites === '1' ? { isFavorite: true } : {},
          order: [
            ['lastName', 'ASC'],
            ['id', 'ASC'],
          ],
          perPage: 15,
          serialize: serializeContact,
        }),
      ),
    })
  }

  @Get(['once-props', 'once-props/:page'])
  onceProps(@Inertia() inertia: InertiaContext, @Param('page') page?: string) {
    return inertia.render('Features/Data/OnceProps', {
      page: page === '2' ? 2 : 1,
      plans: Inertia.once(() => ({ generatedAt: now(), value: randomInt(1000, 9999) })),
      freshData: Inertia.once(() => ({ generatedAt: now(), value: randomInt(1000, 9999) })).fresh(),
      expiringData: Inertia.once(() => ({ generatedAt: now(), value: randomInt(1000, 9999) })).until(5),
      aliasedData: Inertia.once(() => ({ generatedAt: now(), value: randomInt(1000, 9999) })).as('shared-once-key'),
      dynamicData: { generatedAt: now(), value: randomInt(1000, 9999) },
    })
  }

  @Get('polling')
  async polling(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Data/Polling', {
      currentTime: now(),
      randomNumber: randomInt(1, 1000),
      favorites: await Contact.count({ where: { isFavorite: true } }),
    })
  }

  @Get('when-visible')
  whenVisible(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Data/WhenVisible', {
      teamMembers: Inertia.optional(async () => {
        await sleep(600)
        return TEAM
      }),
      statistics: Inertia.optional(async () => {
        await sleep(900)
        return { contacts: await Contact.count(), generatedAt: now() }
      }),
      favorites: Inertia.optional(async () => {
        await sleep(700)
        const contacts = await Contact.findAll({ where: { isFavorite: true }, limit: 5 })
        return contacts.map(serializeContact)
      }),
    })
  }
}
