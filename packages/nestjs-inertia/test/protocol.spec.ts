import {
  Body,
  Catch,
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Post,
  Put,
  RequestMethod,
} from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { IsNotEmpty } from 'class-validator'
import session from 'express-session'
import request from 'supertest'
import {
  Inertia,
  type InertiaContext,
  InertiaExceptionFilter,
  InertiaMiddleware,
  InertiaModule,
  InertiaValidationPipe,
  Precognitive,
  type RenderErrorContext,
  type RootViewContext,
} from '../src/index.js'
import { classValidator } from '../src/validation/class-validator.js'

class ContactDto {
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string

  @IsNotEmpty({ message: 'The email field is required.' })
  email: string
}

let manualPrecognitionCalls = 0

@Controller()
class TestController {
  @Get('page')
  page(@Inertia() inertia: InertiaContext) {
    return inertia.render('Test/Page', {
      title: '</script><b>hi</b>',
      deferred: Inertia.defer(() => 'later'),
    })
  }

  @Get('flash')
  flash(@Inertia() inertia: InertiaContext) {
    return inertia.flash('message', 'Saved!').redirect('/page')
  }

  @Put('update')
  update(@Inertia() inertia: InertiaContext) {
    return inertia.redirect('/page')
  }

  @Post('empty')
  empty() {
    return undefined
  }

  @Get('fragment')
  fragment(@Inertia() inertia: InertiaContext) {
    return inertia.redirect('/page#section')
  }

  @Post('external')
  external(@Inertia() inertia: InertiaContext) {
    return inertia.location('https://example.com/')
  }

  @Post('contacts')
  @Precognitive()
  store(@Inertia() inertia: InertiaContext, @Body() _body: ContactDto) {
    return inertia.redirect('/page')
  }

  @Post('manual')
  @Precognitive()
  manual(@Inertia() inertia: InertiaContext, @Body() _body: Record<string, unknown>) {
    manualPrecognitionCalls++
    return inertia.redirect('/page')
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException('Nope')
  }

  @Get('json')
  json() {
    return { ok: true }
  }
}

@Injectable()
class HandleInertiaRequests extends InertiaMiddleware {
  share() {
    return { appName: 'Test' }
  }

  version() {
    return 'v1'
  }

  rootView({ head, body, assets }: RootViewContext) {
    return `<html><head>${head}${assets}</head><body>${body}</body></html>`
  }
}

@Catch()
class TestExceptionFilter extends InertiaExceptionFilter {
  renderError({ status, inertia }: RenderErrorContext) {
    return status === 403 ? inertia.render('Error', { status }).status(status) : undefined
  }
}

@Module({
  imports: [
    InertiaModule.forRoot({
      vite: { hotFile: 'test/fixtures/hot' },
      ssr: { enabled: false },
      validator: classValidator(),
    }),
  ],
  controllers: [TestController],
  providers: [
    { provide: APP_FILTER, useClass: TestExceptionFilter },
    { provide: APP_PIPE, useClass: InertiaValidationPipe },
  ],
})
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(session({ secret: 'test', resave: false, saveUninitialized: false }), HandleInertiaRequests)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}

const inertia = { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' }

describe('Inertia protocol over HTTP', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('renders an HTML document with the escaped page object on the first visit', async () => {
    const response = await request(app.getHttpServer()).get('/page').expect(200).expect('Content-Type', /html/)

    expect(response.headers.vary).toContain('X-Inertia')
    expect(response.text).toContain('<script data-page="app" type="application/json">')
    expect(response.text).toContain('<div id="app"></div>')
    expect(response.text).toContain('"url":"\\/page"')
    expect(response.text).not.toContain('</script><b>')
    expect(response.text).toContain('http://localhost:5173/@vite/client')

    const json = response.text.match(/<script data-page="app" type="application\/json">(.*?)<\/script>/)![1]
    expect(JSON.parse(json)).toMatchObject({
      component: 'Test/Page',
      props: { errors: {}, appName: 'Test', title: '</script><b>hi</b>' },
      version: 'v1',
      deferredProps: { default: ['deferred'] },
    })
  })

  it('returns the page object as JSON for Inertia visits', async () => {
    const response = await request(app.getHttpServer()).get('/page').set(inertia).expect(200)

    expect(response.headers['x-inertia']).toBe('true')
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({
      component: 'Test/Page',
      props: { errors: {}, appName: 'Test', title: '</script><b>hi</b>' },
      url: '/page',
      version: 'v1',
      sharedProps: ['errors', 'appName'],
      deferredProps: { default: ['deferred'] },
    })
  })

  it('answers a stale GET with 409 and X-Inertia-Location', async () => {
    const response = await request(app.getHttpServer()).get('/page?a=1').set({ ...inertia, 'X-Inertia-Version': 'old' }).expect(409)

    expect(response.headers['x-inertia-location']).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/page\?a=1$/)
    expect(response.headers['x-inertia-version']).toBe('v1')
  })

  it('never answers non-GET requests with a version mismatch', async () => {
    await request(app.getHttpServer()).put('/update').set({ ...inertia, 'X-Inertia-Version': 'old' }).expect(303)
  })

  it('converts 302 to 303 after PUT, PATCH and DELETE', async () => {
    const response = await request(app.getHttpServer()).put('/update').set(inertia).expect(303)
    expect(response.headers.location).toBe('/page')

    // Non-Inertia requests are left alone.
    await request(app.getHttpServer()).put('/update').expect(302)
  })

  it('turns redirects to URLs with a fragment into 409 + X-Inertia-Redirect', async () => {
    const response = await request(app.getHttpServer()).get('/fragment').set(inertia).expect(409)
    expect(response.headers['x-inertia-redirect']).toBe('/page#section')

    // Prefetch requests keep the regular redirect.
    await request(app.getHttpServer()).get('/fragment').set({ ...inertia, Purpose: 'prefetch' }).expect(302)
  })

  it('performs external redirects with 409 + X-Inertia-Location', async () => {
    const response = await request(app.getHttpServer()).post('/external').set(inertia).expect(409)
    expect(response.headers['x-inertia-location']).toBe('https://example.com/')

    await request(app.getHttpServer()).post('/external').expect(302).expect('Location', 'https://example.com/')
  })

  it('redirects back when an Inertia handler returns nothing', async () => {
    const response = await request(app.getHttpServer()).post('/empty').set({ ...inertia, Referer: '/page' }).expect(302)
    expect(response.headers.location).toBe('/page')
  })

  it('delivers flash data once, in the page object', async () => {
    const agent = request.agent(app.getHttpServer())

    await agent.get('/flash').set(inertia).expect(302)

    const first = await agent.get('/page').set(inertia).expect(200)
    expect(first.body.flash).toEqual({ message: 'Saved!' })
    expect(first.body.props.flash).toBeUndefined()

    const second = await agent.get('/page').set(inertia).expect(200)
    expect(second.body.flash).toBeUndefined()
  })

  it('flashes validation errors and redirects back, honouring error bags', async () => {
    const agent = request.agent(app.getHttpServer())

    await agent.post('/contacts').set({ ...inertia, Referer: '/page' }).send({ name: 'Ada' }).expect(302).expect('Location', '/page')
    const page = await agent.get('/page').set(inertia).expect(200)
    expect(page.body.props.errors).toEqual({ email: 'The email field is required.' })

    await agent.post('/contacts').set({ ...inertia, Referer: '/page', 'X-Inertia-Error-Bag': 'createContact' }).send({}).expect(302)
    const bagged = await agent.get('/page').set({ ...inertia, 'X-Inertia-Error-Bag': 'createContact' }).expect(200)
    expect(bagged.body.props.errors).toEqual({
      createContact: { name: 'The name field is required.', email: 'The email field is required.' },
    })
  })

  it('answers JSON requests with a 422', async () => {
    const response = await request(app.getHttpServer()).post('/contacts').set('Accept', 'application/json').send({}).expect(422)
    expect(response.body.errors).toEqual({ name: ['The name field is required.'], email: ['The email field is required.'] })
  })

  it('implements Precognition', async () => {
    const precognition = { Precognition: 'true', Accept: 'application/json' }

    const failed = await request(app.getHttpServer())
      .post('/contacts')
      .set({ ...precognition, 'Precognition-Validate-Only': 'name' })
      .send({})
      .expect(422)
    expect(failed.headers.precognition).toBe('true')
    expect(failed.headers.vary).toContain('Precognition')
    expect(failed.body.errors).toEqual({ name: ['The name field is required.'] })

    const passed = await request(app.getHttpServer())
      .post('/contacts')
      .set({ ...precognition, 'Precognition-Validate-Only': 'name' })
      .send({ name: 'Ada' })
      .expect(204)
    expect(passed.headers['precognition-success']).toBe('true')
  })

  it('never runs a @Precognitive() handler for Precognition requests, even without a DTO', async () => {
    manualPrecognitionCalls = 0

    const response = await request(app.getHttpServer())
      .post('/manual')
      .set({ Precognition: 'true', Accept: 'application/json' })
      .send({ name: 'Ada' })
      .expect(204)
    expect(response.headers['precognition-success']).toBe('true')
    expect(manualPrecognitionCalls).toBe(0)

    // Real submissions still reach the handler.
    await request(app.getHttpServer()).post('/manual').set(inertia).send({ name: 'Ada' }).expect(302)
    expect(manualPrecognitionCalls).toBe(1)
  })

  it('renders error pages with the real status code', async () => {
    const response = await request(app.getHttpServer()).get('/forbidden').set(inertia).expect(403)
    expect(response.headers['x-inertia']).toBe('true')
    expect(response.body).toMatchObject({ component: 'Error', props: { status: 403 } })
  })

  it('leaves non-Inertia responses untouched', async () => {
    await request(app.getHttpServer()).get('/json').expect(200, { ok: true })
  })
})
