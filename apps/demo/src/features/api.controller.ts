import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { Op } from 'sequelize'
import { AuthGuard } from '../auth/auth.js'
import { sleep } from '../common/time.js'
import { Contact } from '../database/models/index.js'
import { GreetingDto } from './dto.js'

/** Plain JSON endpoints, consumed with `useHttp` (no Inertia visit). */
@Controller('api')
@UseGuards(AuthGuard)
export class ApiController {
  @Post('greetings')
  async greet(@Body() body: GreetingDto) {
    await sleep(400)

    return { message: `Hello, ${body.name}!`, at: new Date().toISOString() }
  }

  @Get('contacts')
  async search(@Query('query') query = '') {
    const contacts = await Contact.findAll({
      where: {
        [Op.or]: [{ firstName: { [Op.like]: `%${query}%` } }, { lastName: { [Op.like]: `%${query}%` } }],
      },
      order: [['lastName', 'ASC']],
      limit: 5,
    })

    return { query, results: contacts.map((contact) => ({ id: contact.id as number, name: contact.name })) }
  }
}
