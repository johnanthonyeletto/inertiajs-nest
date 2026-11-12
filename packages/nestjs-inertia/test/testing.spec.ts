import { AssertionError } from 'node:assert'
import { Controller, Get, type INestApplication, type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Inertia, type InertiaContext, InertiaMiddleware, InertiaModule } from '../src/index.js'
import { assertInertia, deferredPropsHeaders, inertiaHeaders, inertiaPage } from '../src/testing/index.js'

@Controller()
class UsersController {
  @Get('users/1')
  show(@Inertia() inertia: InertiaContext) {
    return inertia
      .render('Users/Show', {
        user: { name: 'Ada', id: 900719925474099988n, roles: ['admin', 'owner'] },
        stats: Inertia.defer(() => ({ visits: 3 }), 'sidebar'),
        teams: Inertia.optional(() => ['core']),
      })
      .preserveBigIntegers()
  }
}

@Module({
  imports: [InertiaModule.forRoot({ vite: { hotFile: 'test/fixtures/hot' }, ssr: { enabled: false } })],
  controllers: [UsersController],
})
class TestingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(InertiaMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}

describe('@johnanthonyeletto/nestjs-inertia/testing', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestingModule] }).compile()
    app = moduleRef.createNestApplication({ logger: false })
    await app.init()
  })

  afterAll(() => app.close())

  it('asserts against JSON Inertia responses, reviving big integers', async () => {
    const response = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders())

    assertInertia(response, (page) =>
      page
        .component('Users/Show')
        .url('/users/1')
        .version('')
        .has('user', 3)
        .has('user.roles', 2)
        .where('user.name', 'Ada')
        .where('user.id', 900719925474099988n)
        .where('user.roles', (roles: string[]) => roles.includes('owner'))
        .has('user', (user) => user.where('roles.0', 'admin'))
        .missing('stats')
        .missing('teams')
        .hasDeferred('stats', 'sidebar'),
    )
  })

  it('reads the page object from an HTML page load', async () => {
    const response = await request(app.getHttpServer()).get('/users/1')

    expect(inertiaPage(response).component).toBe('Users/Show')
    assertInertia(response).where('user.name', 'Ada')
  })

  it('builds partial reload and deferred prop requests', async () => {
    const first = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders())
    const page = inertiaPage(first)

    const deferred = await request(app.getHttpServer()).get('/users/1').set(deferredPropsHeaders(page, 'sidebar'))
    assertInertia(deferred).where('stats', { visits: 3 }).missing('user')

    const partial = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders({ page, only: ['teams'] }))
    assertInertia(partial).where('teams', ['core']).missing('user')
  })

  it('throws AssertionErrors with useful messages', async () => {
    const response = await request(app.getHttpServer()).get('/users/1').set(inertiaHeaders())
    const page = assertInertia(response)

    expect(() => page.component('Users/Edit')).toThrow(AssertionError)
    expect(() => page.has('user.email')).toThrow('Inertia property [user.email] does not exist.')
    expect(() => page.has('user.roles', 3)).toThrow('does not have the expected size')
    expect(() => page.where('user.name', 'Grace')).toThrow('does not match the expected value')
    expect(() => page.missing('user')).toThrow('expected to be missing')
    expect(() => page.hasDeferred('teams')).toThrow('is not deferred')
    expect(() => inertiaPage({ headers: {}, text: '{}' })).toThrow('is not an Inertia response')
  })
})
