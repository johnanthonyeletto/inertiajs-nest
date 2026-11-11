import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.js'
import { Contact, Note, Organization, User } from '../database/models/index.js'
import { Inertia, type InertiaContext } from 'inertia-nest'
import { serializeContact, serializeNote } from './serializers.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

@Controller()
@UseGuards(AuthGuard)
export class DashboardController {
  @Get()
  async index(@Inertia() inertia: InertiaContext) {
    return inertia.render('Dashboard', {
      stats: {
        organizations: await Organization.count(),
        contacts: await Contact.count(),
        favorites: await Contact.count({ where: { isFavorite: true } }),
        notes: await Note.count(),
      },

      // Loaded after the page renders, in two parallel request groups.
      recentNotes: Inertia.defer(async () => {
        await sleep(600)
        const notes = await Note.findAll({ include: [Contact, User], order: [['createdAt', 'DESC']], limit: 5 })

        return notes.map(serializeNote)
      }),
      favorites: Inertia.defer(async () => {
        await sleep(1000)
        const contacts = await Contact.findAll({ where: { isFavorite: true }, order: [['lastName', 'ASC']], limit: 6 })

        return contacts.map(serializeContact)
      }, 'sidebar'),
    })
  }
}
