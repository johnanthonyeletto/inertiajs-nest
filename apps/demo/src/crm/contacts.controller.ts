import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { Op, type WhereOptions } from 'sequelize'
import { AuthGuard } from '../auth/auth.js'
import { Contact, Note, Organization, User } from '../database/models/index.js'
import { paginate } from '../database/paginator.js'
import { Inertia, type InertiaContext, ValidationException } from 'inertia-nest'
import { deleteAvatar, storeAvatar } from './avatars.js'
import { ContactDto, FiltersDto, NoteDto } from './dto.js'
import { serializeContact, serializeNote } from './serializers.js'

const avatarUpload = FileInterceptor('avatar', { limits: { fileSize: 10 * 1024 * 1024 } })

@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  @Get()
  async index(@Inertia() inertia: InertiaContext, @Req() request: Request, @Query() filters: FiltersDto) {
    const where: WhereOptions = {
      ...(filters.search && {
        [Op.or]: ['firstName', 'lastName', 'email'].map((column) => ({
          [column]: { [Op.like]: `%${filters.search}%` },
        })),
      }),
      ...(filters.trashed === 'only' && { deletedAt: { [Op.ne]: null } }),
    }

    return inertia.render('Contacts/Index', {
      filters: { search: filters.search ?? '', trashed: filters.trashed ?? '' },
      contacts: await paginate(Contact, request, {
        where,
        include: [Organization],
        paranoid: !filters.trashed,
        order: [
          ['lastName', 'ASC'],
          ['firstName', 'ASC'],
        ],
        serialize: serializeContact,
      }),
    })
  }

  @Get('create')
  create(@Inertia() inertia: InertiaContext) {
    return inertia.render('Contacts/Create', { organizations: this.organizations() })
  }

  @Post()
  @UseInterceptors(avatarUpload)
  async store(
    @Inertia() inertia: InertiaContext,
    @Body() body: ContactDto,
    @UploadedFile() avatar: Express.Multer.File | undefined,
  ) {
    await this.ensureOrganizationExists(body.organizationId)

    const contact = await Contact.create({ ...body, avatarPath: avatar ? await storeAvatar(avatar) : null })

    return inertia
      .flash('toast', { type: 'success', message: `${contact.name} was created.` })
      .flash('createdContactId', contact.id)
      .redirect('/contacts')
  }

  @Get(':id/edit')
  async edit(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    const contact = await this.find(id)

    return inertia.render('Contacts/Edit', {
      contact: serializeContact(contact),
      organizations: this.organizations(),
      notes: async () => {
        const notes = await Note.findAll({ where: { contactId: id }, include: [User], order: [['createdAt', 'DESC']] })

        return notes.map(serializeNote)
      },
    })
  }

  @Put(':id')
  @UseInterceptors(avatarUpload)
  async update(
    @Inertia() inertia: InertiaContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ContactDto,
    @UploadedFile() avatar: Express.Multer.File | undefined,
  ) {
    const contact = await this.find(id)

    await this.ensureOrganizationExists(body.organizationId)

    if (avatar) {
      const previous = contact.avatarPath
      contact.avatarPath = await storeAvatar(avatar)
      await deleteAvatar(previous)
    }

    await contact.update({ ...body })

    return inertia.flash('toast', { type: 'success', message: 'Contact updated.' }).back()
  }

  @Delete(':id')
  async destroy(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    await (await this.find(id)).destroy()

    return inertia.flash('toast', { type: 'success', message: 'Contact deleted.' }).back()
  }

  @Put(':id/restore')
  async restore(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    await (await this.find(id)).restore()

    return inertia.flash('toast', { type: 'success', message: 'Contact restored.' }).back()
  }

  @Post(':id/favorite')
  async favorite(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    const contact = await this.find(id)

    await contact.update({ isFavorite: !contact.isFavorite })

    return inertia.back()
  }

  @Post(':id/notes')
  async addNote(
    @Inertia() inertia: InertiaContext,
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: NoteDto,
  ) {
    await this.find(id)
    await Note.create({ contactId: id, userId: request.user!.id, body: body.body })

    return inertia.flash('toast', { type: 'success', message: 'Note added.' }).back()
  }

  /**
   * The organization list rarely changes, so it is a once prop: resolved on
   * the first visit to the create or edit page, then reused by the client
   * (for up to five minutes) instead of being sent again.
   */
  private organizations() {
    return Inertia.once(async () => {
      const organizations = await Organization.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] })

      return organizations.map(({ id, name }) => ({ id: id as number, name }))
    }).until(300)
  }

  private async ensureOrganizationExists(organizationId: number | null): Promise<void> {
    if (organizationId !== null && organizationId !== undefined && !(await Organization.findByPk(organizationId))) {
      throw ValidationException.withMessages({ organizationId: 'The selected organization is invalid.' })
    }
  }

  private async find(id: number): Promise<Contact> {
    const contact = await Contact.findByPk(id, { paranoid: false, include: [Organization] })

    if (!contact) {
      throw new NotFoundException('Contact not found.')
    }

    return contact
  }
}
