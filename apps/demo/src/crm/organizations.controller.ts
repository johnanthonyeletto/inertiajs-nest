import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { Op, type WhereOptions } from 'sequelize'
import { AuthGuard } from '../auth/auth.js'
import { Contact, Organization } from '../database/models/index.js'
import { paginate } from '../database/paginator.js'
import { Inertia, type InertiaContext } from 'inertia-nest'
import { FiltersDto, OrganizationDto } from './dto.js'
import { serializeContact, serializeOrganization } from './serializers.js'

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  @Get()
  async index(@Inertia() inertia: InertiaContext, @Req() request: Request, @Query() filters: FiltersDto) {
    const where: WhereOptions = {
      ...(filters.search && { name: { [Op.like]: `%${filters.search}%` } }),
      ...(filters.trashed === 'only' && { deletedAt: { [Op.ne]: null } }),
    }

    return inertia.render('Organizations/Index', {
      filters: { search: filters.search ?? '', trashed: filters.trashed ?? '' },
      organizations: await paginate(Organization, request, {
        where,
        paranoid: !filters.trashed,
        order: [['name', 'ASC']],
        serialize: serializeOrganization,
      }),
    })
  }

  @Get('create')
  create(@Inertia() inertia: InertiaContext) {
    return inertia.render('Organizations/Create')
  }

  @Post()
  async store(@Inertia() inertia: InertiaContext, @Body() body: OrganizationDto) {
    const organization = await Organization.create({ ...body })

    return inertia
      .flash('toast', { type: 'success', message: 'Organization created.' })
      .redirect(`/organizations/${organization.id}/edit`)
  }

  @Get(':id/edit')
  async edit(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    const organization = await this.find(id)

    return inertia.render('Organizations/Edit', {
      organization: serializeOrganization(organization),
      contacts: async () => {
        const contacts = await Contact.findAll({ where: { organizationId: id }, order: [['lastName', 'ASC']] })

        return contacts.map(serializeContact)
      },
    })
  }

  @Put(':id')
  async update(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number, @Body() body: OrganizationDto) {
    await (await this.find(id)).update({ ...body })

    return inertia.flash('toast', { type: 'success', message: 'Organization updated.' }).back()
  }

  @Delete(':id')
  async destroy(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    await (await this.find(id)).destroy()

    return inertia.flash('toast', { type: 'success', message: 'Organization deleted.' }).back()
  }

  @Put(':id/restore')
  async restore(@Inertia() inertia: InertiaContext, @Param('id', ParseIntPipe) id: number) {
    await (await this.find(id)).restore()

    return inertia.flash('toast', { type: 'success', message: 'Organization restored.' }).back()
  }

  private async find(id: number): Promise<Organization> {
    const organization = await Organization.findByPk(id, { paranoid: false })

    if (!organization) {
      throw new NotFoundException('Organization not found.')
    }

    return organization
  }
}
