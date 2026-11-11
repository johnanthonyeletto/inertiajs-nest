import { faker } from '@faker-js/faker'
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { hashPassword } from '../auth/password.js'
import { Contact, Note, Organization, User } from './models/index.js'

export const DEMO_USER = { email: 'johndoe@example.com', password: 'secret' }

/** Seeds deterministic demo data. */
export async function seed(): Promise<void> {
  faker.seed(20261012)

  const user = await User.create({
    firstName: 'John',
    lastName: 'Doe',
    email: DEMO_USER.email,
    password: await hashPassword(DEMO_USER.password),
  })

  const organizations = await Organization.bulkCreate(
    Array.from({ length: 24 }, () => ({
      name: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number({ style: 'national' }),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      region: faker.location.state({ abbreviated: true }),
      country: faker.helpers.arrayElement(['US', 'CA']),
      postalCode: faker.location.zipCode(),
    })),
  )

  const contacts = await Contact.bulkCreate(
    Array.from({ length: 150 }, () => {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()

      return {
        organizationId: faker.helpers.arrayElement(organizations).id as number,
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        region: faker.location.state({ abbreviated: true }),
        country: faker.helpers.arrayElement(['US', 'CA']),
        postalCode: faker.location.zipCode(),
        isFavorite: faker.datatype.boolean({ probability: 0.2 }),
      }
    }),
  )

  await Note.bulkCreate(
    faker.helpers.arrayElements(contacts, 40).map((contact) => ({
      contactId: contact.id as number,
      userId: user.id as number,
      body: faker.lorem.sentences({ min: 1, max: 3 }),
      createdAt: faker.date.recent({ days: 30 }),
    })),
  )
}

/** Seeds the database on boot when it is empty, so the demo works out of the box. */
@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger('Database')

  async onApplicationBootstrap(): Promise<void> {
    if ((await User.count()) === 0) {
      await seed()
      this.logger.log(`Seeded demo data. Sign in with ${DEMO_USER.email} / ${DEMO_USER.password}`)
    }
  }
}
