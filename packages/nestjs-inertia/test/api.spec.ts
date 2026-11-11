import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  All,
  type ArgumentsHost,
  Body,
  type CallHandler,
  Catch,
  type ExecutionContext,
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestInterceptor,
  type NestModule,
  Post,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { map } from 'rxjs'
import { Test } from '@nestjs/testing'
import { IsNotEmpty } from 'class-validator'
import express from 'express'
import session from 'express-session'
import request from 'supertest'
import * as z from 'zod'
import {
  Inertia,
  INERTIA_CONFIG,
  type InertiaConfig,
  type InertiaContext,
  InertiaExceptionFilter,
  InertiaMiddleware,
  InertiaModule,
  InertiaValidationPipe,
  markResponseHandled,
  objectSession,
  Precognitive,
  type InertiaSessionData,
} from '../src/index.js'
import { classValidator, inertiaExceptionFactory } from '../src/validation/class-validator.js'
import { zodDto, zodValidator } from '../src/validation/zod.js'

const inertia = { 'X-Inertia': 'true', 'X-Inertia-Version': '' }

const hotFile = 'test/fixtures/hot'

async function createApp(module: unknown): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [module as never] }).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  await app.init()

  return app
}

function applyEverywhere(consumer: MiddlewareConsumer, ...middleware: unknown[]) {
  consumer.apply(...(middleware as [never])).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
}

const withSession = session({ secret: 'test', resave: false, saveUninitialized: false })

describe('protocol additions', () => {
  @Controller()
  class BigIntController {
    @Get('big')
    big(@Inertia() inertia: InertiaContext) {
      return inertia
        .render('Big', { id: 900719925474099988n, small: 42n, nested: { ids: [1n, -900719925474099988n] } })
        .preserveBigIntegers()
    }

    @Get('big-default')
    bigDefault(@Inertia() inertia: InertiaContext) {
      return inertia.render('Big', { count: 3 })
    }

    @All('query')
    query(@Inertia() inertia: InertiaContext) {
      return inertia.redirect('/big')
    }
  }

  @Module({
    imports: [InertiaModule.forRoot({ vite: { hotFile }, ssr: { enabled: false } })],
    controllers: [BigIntController],
  })
  class BigIntModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      applyEverywhere(consumer, InertiaMiddleware)
    }
  }

  let app: INestApplication

  beforeAll(async () => {
    app = await createApp(BigIntModule)
  })

  afterAll(() => app.close())

  it('wraps unsafe big integers in $bigint markers and flags the page', async () => {
    const response = await request(app.getHttpServer()).get('/big').set(inertia).expect(200)

    expect(response.body.preserveBigIntegers).toBe(true)
    expect(response.body.props).toMatchObject({
      id: { $bigint: '900719925474099988' },
      small: 42,
      nested: { ids: [1, { $bigint: '-900719925474099988' }] },
    })

    const html = await request(app.getHttpServer()).get('/big').expect(200)
    expect(html.text).toContain('{"$bigint":"900719925474099988"}')
    expect(html.text).toContain('"preserveBigIntegers":true')
  })

  it('omits preserveBigIntegers unless enabled', async () => {
    const response = await request(app.getHttpServer()).get('/big-default').set(inertia).expect(200)
    expect(response.body).not.toHaveProperty('preserveBigIntegers')
  })

  it('converts a 302 after a QUERY request into a 303', async () => {
    const server = app.getHttpServer().listen(0)
    const { port } = server.address() as AddressInfo

    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest({ port, method: 'QUERY', path: '/query', headers: inertia }, (res) => {
        res.resume()
        resolve(res.statusCode)
      })
      req.on('error', reject)
      req.end()
    })

    server.close()
    expect(status).toBe(303)
  })
})

describe('validation integrations', () => {
  class ContactDto {
    @IsNotEmpty({ message: 'The name field is required.' })
    name: string

    @IsNotEmpty({ message: 'The email field is required.' })
    email: string
  }

  const ZodContact = z.object({
    name: z.string().min(1, 'The name field is required.'),
    address: z.object({ city: z.string().min(1, 'The city field is required.') }),
  })

  class ZodContactDto extends zodDto(ZodContact) {}

  const calls = { nest: 0, zod: 0 }

  @Controller()
  class ValidationController {
    @Post('nest-pipe')
    @Precognitive()
    nestPipe(@Inertia() inertia: InertiaContext, @Body(new ValidationPipe({ exceptionFactory: inertiaExceptionFactory })) _body: ContactDto) {
      calls.nest++
      return inertia.redirect('/done')
    }

    @Post('zod')
    @Precognitive()
    zod(@Inertia() inertia: InertiaContext, @Body() body: ZodContactDto) {
      calls.zod++
      return inertia.flash('city', body.address.city).redirect('/done')
    }
  }

  @Module({
    imports: [InertiaModule.forRoot({ vite: { hotFile }, ssr: { enabled: false }, validator: zodValidator() })],
    controllers: [ValidationController],
    providers: [
      { provide: APP_FILTER, useClass: InertiaExceptionFilter },
      { provide: APP_PIPE, useClass: InertiaValidationPipe },
    ],
  })
  class ValidationModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      applyEverywhere(consumer, withSession, InertiaMiddleware)
    }
  }

  let app: INestApplication

  beforeAll(async () => {
    app = await createApp(ValidationModule)
  })

  afterAll(() => app.close())

  it("converts Nest ValidationPipe failures with inertiaExceptionFactory", async () => {
    await request(app.getHttpServer())
      .post('/nest-pipe')
      .set({ ...inertia, Referer: '/form' })
      .send({ name: 'Ada' })
      .expect(302)
      .expect('Location', '/form')

    const response = await request(app.getHttpServer())
      .post('/nest-pipe')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'name', Accept: 'application/json' })
      .send({ name: 'Ada' })
      .expect(204)
    expect(response.headers['precognition-success']).toBe('true')

    const failed = await request(app.getHttpServer())
      .post('/nest-pipe')
      .set({ Precognition: 'true', Accept: 'application/json' })
      .send({ name: 'Ada' })
      .expect(422)
    expect(failed.body.errors).toEqual({ email: ['The email field is required.'] })
    expect(calls.nest).toBe(0)
  })

  it('validates zodDto classes with nested dot-notation errors', async () => {
    const failed = await request(app.getHttpServer())
      .post('/zod')
      .set('Accept', 'application/json')
      .send({ name: '', address: { city: '' } })
      .expect(422)
    expect(failed.body.errors).toEqual({
      name: ['The name field is required.'],
      'address.city': ['The city field is required.'],
    })

    await request(app.getHttpServer())
      .post('/zod')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'name', Accept: 'application/json' })
      .send({ name: 'Ada', address: {} })
      .expect(204)
    expect(calls.zod).toBe(0)

    const agent = request.agent(app.getHttpServer())
    await agent.post('/zod').set(inertia).send({ name: 'Ada', address: { city: 'London' } }).expect(302).expect('Location', '/done')
    expect(calls.zod).toBe(1)
  })

  it('passes class-validator DTOs through the classValidator() adapter', async () => {
    const validator = classValidator()
    const result = await validator.validate({ name: 'Ada' }, ContactDto, { type: 'body', metatype: ContactDto })

    expect(result).toEqual({ success: false, errors: { email: ['The email field is required.'] } })
    expect(validator.supports(String)).toBe(false)
    expect(validator.supports(ContactDto)).toBe(true)
  })
})

describe('library integration', () => {
  @Injectable()
  class Greeter {
    greeting() {
      return 'hello'
    }
  }

  // Subclasses keep their own constructor dependencies: the adapter's services are property-injected.
  @Injectable()
  class HandleInertiaRequests extends InertiaMiddleware {
    constructor(private readonly greeter: Greeter) {
      super()
    }

    share() {
      return { greeting: this.greeter.greeting() }
    }

    version() {
      return 'custom'
    }
  }

  @Controller()
  @Precognitive()
  class LibraryController {
    static calls = 0

    @Get('page')
    page(@Inertia() inertia: InertiaContext) {
      return inertia.render('Page')
    }

    @Post('flash')
    flash(@Inertia() inertia: InertiaContext) {
      LibraryController.calls++
      return inertia.flash('message', 'stored').redirect('/page')
    }

    @Get('forbidden')
    forbidden() {
      throw new ForbiddenException('Nope')
    }

    @Get('crash')
    crash() {
      throw new Error('boom')
    }
  }

  // A session kept in memory and keyed by a header, to prove the session is pluggable.
  const sessions = new Map<string, InertiaSessionData>()

  @Module({ providers: [{ provide: 'SETTINGS', useValue: { hotFile } }], exports: ['SETTINGS'] })
  class SettingsModule {}

  @Module({
    imports: [
      InertiaModule.forRootAsync({
        inject: ['SETTINGS'],
        useFactory: (settings: { hotFile: string }): InertiaConfig => ({
          vite: { hotFile: settings.hotFile },
          ssr: { enabled: false },
          session: (req) => {
            const id = req.get('X-Session')
            if (!id) return null
            if (!sessions.has(id)) sessions.set(id, {})
            return objectSession(sessions.get(id)!)
          },
        }),
        imports: [SettingsModule],
      }),
    ],
    controllers: [LibraryController],
    providers: [
      Greeter,
      { provide: APP_FILTER, useClass: InertiaExceptionFilter },
    ],
  })
  class LibraryModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      applyEverywhere(consumer, HandleInertiaRequests)
    }
  }

  let app: INestApplication
  const headers = { 'X-Inertia': 'true', 'X-Inertia-Version': 'custom' }

  beforeAll(async () => {
    app = await createApp(LibraryModule)
  })

  afterAll(() => app.close())

  it('configures the module asynchronously', () => {
    expect(app.get<InertiaConfig>(INERTIA_CONFIG).vite?.hotFile).toBe(hotFile)
  })

  it('lets a middleware subclass inject its own dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/page').set(headers).expect(200)
    expect(response.body.props).toEqual({ errors: {}, greeting: 'hello' })
    expect(response.body.version).toBe('custom')
  })

  it('stores flash data through a custom session', async () => {
    await request(app.getHttpServer()).post('/flash').set({ ...headers, 'X-Session': 'a' }).expect(302)
    expect(sessions.get('a')).toEqual({ flash: { message: 'stored' } })

    const response = await request(app.getHttpServer()).get('/page').set({ ...headers, 'X-Session': 'a' }).expect(200)
    expect(response.body.flash).toEqual({ message: 'stored' })
    expect(sessions.get('a')).toEqual({})
  })

  it('discards session state when there is no session', async () => {
    await request(app.getHttpServer()).post('/flash').set(headers).expect(302)
    const response = await request(app.getHttpServer()).get('/page').set(headers).expect(200)
    expect(response.body).not.toHaveProperty('flash')
  })

  it('guards every handler of a @Precognitive() controller', async () => {
    LibraryController.calls = 0
    await request(app.getHttpServer()).post('/flash').set({ Precognition: 'true', Accept: 'application/json' }).expect(204)
    expect(LibraryController.calls).toBe(0)
  })

  it('hands API errors to Nest default exception handling', async () => {
    const forbidden = await request(app.getHttpServer()).get('/forbidden').set('Accept', 'application/json').expect(403)
    expect(forbidden.body).toEqual({ statusCode: 403, message: 'Nope', error: 'Forbidden' })

    const crashed = await request(app.getHttpServer()).get('/crash').set('Accept', 'application/json').expect(500)
    expect(crashed.body).toEqual({ statusCode: 500, message: 'Internal server error' })
  })

  it('falls back to Nest default handling when renderError() renders nothing', async () => {
    await request(app.getHttpServer()).get('/forbidden').set(headers).expect(403)
  })
})

describe('Nest reply after an adapter response', () => {
  const caught: unknown[] = []

  @Catch()
  class RecordingFilter extends InertiaExceptionFilter {
    override catch(exception: unknown, host: ArgumentsHost) {
      caught.push(exception)
      return super.catch(exception, host)
    }
  }

  @Controller()
  class ReplyController {
    @Get('page')
    page(@Inertia() inertia: InertiaContext) {
      return inertia.render('Page')
    }

    @Post('save')
    save(@Inertia() inertia: InertiaContext) {
      return inertia.redirect('/page')
    }
  }

  // Apps commonly wrap every result (`{ data }`). Registered before Inertia's
  // interceptor, it turns the adapter's empty result into a body that Nest
  // then tries to send on the already-sent response.
  @Injectable()
  class WrapResults implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler) {
      return next.handle().pipe(map((data) => ({ data })))
    }
  }

  @Module({ providers: [{ provide: APP_INTERCEPTOR, useClass: WrapResults }] })
  class WrapModule {}

  @Module({
    imports: [WrapModule, InertiaModule.forRoot({ vite: { hotFile }, ssr: { enabled: false } })],
    controllers: [ReplyController],
    providers: [{ provide: APP_FILTER, useClass: RecordingFilter }],
  })
  class WrappedReplyModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      applyEverywhere(consumer, InertiaMiddleware)
    }
  }

  let app: INestApplication

  beforeAll(async () => {
    app = await createApp(WrappedReplyModule)
  })

  afterAll(() => app.close())

  it('does not raise "headers already sent" when Nest replies after an adapter response', async () => {
    await request(app.getHttpServer()).get('/page').set(inertia).expect(200)
    await request(app.getHttpServer()).get('/page').expect(200)
    await request(app.getHttpServer()).post('/save').set(inertia).expect(302)

    expect(caught).toEqual([])
  })
})

describe('markResponseHandled', () => {
  it('ignores a second reply to a response the adapter already sent', async () => {
    const errors: unknown[] = []
    const server = express()

    server.get('/', (_req, res) => {
      res.status(201).json({ first: true })
      markResponseHandled(res)

      try {
        res.status(200).send()
        res.json({ second: true })
      } catch (error) {
        errors.push(error)
      }
    })

    const response = await request(server).get('/').expect(201)
    expect(response.body).toEqual({ first: true })
    expect(errors).toEqual([])
  })
})

describe('module without Inertia middleware', () => {
  @Controller()
  class BareController {
    @Post('submit')
    @Precognitive()
    submit() {
      return { ok: true }
    }
  }

  @Module({
    imports: [InertiaModule.forRoot({ ssr: { enabled: false } })],
    controllers: [BareController],
  })
  class BareModule {}

  let app: INestApplication

  beforeAll(async () => {
    app = await createApp(BareModule)
  })

  afterAll(() => app.close())

  it('refuses Precognition requests rather than running the handler', async () => {
    await request(app.getHttpServer()).post('/submit').set('Precognition', 'true').expect(500)
    await request(app.getHttpServer()).post('/submit').expect(201, { ok: true })
  })
})

