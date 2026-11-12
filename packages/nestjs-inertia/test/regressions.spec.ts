/**
 * Regression tests for issues found in the grounded review of 2026-11-11
 * (run 20261111-173648). Each describe names the finding it covers.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Post,
  Query,
  Redirect,
  RequestMethod,
} from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { IsInt, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'
import session from 'express-session'
import request from 'supertest'
import { startSsr } from '../src/cli/ssr.js'
import {
  Inertia,
  type InertiaContext,
  InertiaExceptionFilter,
  InertiaMiddleware,
  InertiaModule,
  InertiaValidationPipe,
  Precognitive,
  Vite,
} from '../src/index.js'
import { assertInertia, inertiaHeaders } from '../src/testing/index.js'
import { classValidator } from '../src/validation/class-validator.js'

const hotFile = 'test/fixtures/hot'

async function createApp(module: unknown): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [module as never] }).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  await app.init()

  return app
}

class ContactDto {
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string

  @IsNotEmpty({ message: 'The email field is required.' })
  email: string
}

class FilterDto {
  @Type(() => Number)
  @IsInt({ message: 'The page must be an integer.' })
  page: number
}

const handlerCalls: string[] = []

abstract class CrudController {
  @Post('store')
  store(@Body() _body: ContactDto) {
    handlerCalls.push('inherited store')
    return { stored: true }
  }
}

// F2, shape 1: a decorated controller inheriting its handler.
@Controller('inherits')
@Precognitive()
class InheritingController extends CrudController {}

// F2: the base class's other subclasses must stay unguarded.
@Controller('sibling')
class SiblingController extends CrudController {}

// F2, shape 2: decorated base class, handler declared on the subclass.
@Precognitive()
abstract class PrecognitiveBase {}

@Controller('subclass')
class SubclassController extends PrecognitiveBase {
  @Post('store')
  store(@Body() _body: ContactDto) {
    handlerCalls.push('subclass store')
    return { stored: true }
  }
}

@Controller()
class MiscController {
  @Get('page')
  page(@Inertia() inertia: InertiaContext) {
    return inertia.render('Page')
  }

  @Post('search')
  @Precognitive()
  search(@Query() _query: FilterDto, @Body() _body: ContactDto) {
    handlerCalls.push('search')
  }
}

let failVersion = false

@Injectable()
class HandleInertiaRequests extends InertiaMiddleware {
  async version() {
    if (failVersion) throw new Error('version store unavailable')
    return 'v1'
  }
}

@Module({
  imports: [InertiaModule.forRoot({ vite: { hotFile }, ssr: { enabled: false }, validator: classValidator() })],
  controllers: [InheritingController, SiblingController, SubclassController, MiscController],
  providers: [
    { provide: APP_FILTER, useClass: InertiaExceptionFilter },
    { provide: APP_PIPE, useClass: InertiaValidationPipe },
  ],
})
class RegressionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(session({ secret: 'test', resave: false, saveUninitialized: false }), HandleInertiaRequests)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}

const precognition = { Precognition: 'true', Accept: 'application/json' }

describe('grounded review regressions', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createApp(RegressionModule)
  })

  afterAll(() => app.close())

  beforeEach(() => {
    handlerCalls.length = 0
    failVersion = false
  })

  describe('F2: class-level @Precognitive() and inheritance', () => {
    it('guards handlers inherited by a decorated controller', async () => {
      await request(app.getHttpServer())
        .post('/inherits/store')
        .set({ ...precognition, 'Precognition-Validate-Only': 'name' })
        .send({ name: 'Ada', email: '' })
        .expect(204)

      expect(handlerCalls).toEqual([])
    })

    it('leaves the base class and its other subclasses unguarded', async () => {
      await request(app.getHttpServer()).post('/sibling/store').set(precognition).send({ name: 'Ada', email: 'a@b.c' }).expect(201)
      expect(handlerCalls).toEqual(['inherited store'])
    })

    it('fails closed when the decorator is on a base class and the handler on a subclass', async () => {
      await request(app.getHttpServer()).post('/subclass/store').set(precognition).send({ name: 'Ada', email: 'a@b.c' }).expect(500)
      expect(handlerCalls).toEqual([])
    })
  })

  describe('F3: reads never write to the session', () => {
    it('does not start a session for an anonymous page render', async () => {
      const response = await request(app.getHttpServer()).get('/page').set(inertiaHeaders({ version: 'v1' })).expect(200)
      expect(response.headers['set-cookie']).toBeUndefined()

      const html = await request(app.getHttpServer()).get('/page').expect(200)
      expect(html.headers['set-cookie']).toBeUndefined()
    })
  })

  describe('F4: failures inside the exception filter', () => {
    it('still answers when version() throws, without an unhandled rejection', async () => {
      const unhandled: unknown[] = []
      const listener = (reason: unknown) => unhandled.push(reason)
      process.on('unhandledRejection', listener)

      try {
        failVersion = true
        await request(app.getHttpServer()).get('/page').set(inertiaHeaders({ version: 'v1' })).timeout(3000).expect(500)
        await new Promise((resolve) => setTimeout(resolve, 20))
      } finally {
        process.off('unhandledRejection', listener)
      }

      expect(unhandled).toEqual([])
    })
  })

  describe('F9: query validation on Precognition requests', () => {
    it('reports query errors even when they are not in Precognition-Validate-Only', async () => {
      const response = await request(app.getHttpServer())
        .post('/search?page=abc')
        .set({ ...precognition, 'Precognition-Validate-Only': 'name' })
        .send({ name: 'Ada' })
        .expect(422)

      expect(response.body.errors).toEqual({ page: ['The page must be an integer.'] })
      expect(handlerCalls).toEqual([])
    })
  })

  describe('F7/F15: testing helpers', () => {
    it('explains an asset version mismatch', async () => {
      const response = await request(app.getHttpServer()).get('/page').set(inertiaHeaders())
      expect(() => assertInertia(response)).toThrow('asset version mismatch (409): it expects version "v1"')
    })

    it('rejects a partial reload without a component', () => {
      expect(() => inertiaHeaders({ only: ['stats'] })).toThrow('needs the `page` or `component`')
      expect(inertiaHeaders({ component: 'Page', only: ['stats'] })).toMatchObject({
        'X-Inertia-Partial-Component': 'Page',
        'X-Inertia-Partial-Data': 'stats',
      })
    })
  })
})

describe('F6: no errors reach the filter after a version-change 409', () => {
  const caught: unknown[] = []

  class RecordingFilter extends InertiaExceptionFilter {
    override catch(exception: unknown, host: Parameters<InertiaExceptionFilter['catch']>[1]) {
      caught.push(exception)
      return super.catch(exception, host)
    }
  }

  @Controller()
  class RedirectController {
    @Get('old')
    @Redirect('/new')
    old() {}
  }

  @Injectable()
  class VersionedMiddleware extends InertiaMiddleware {
    version() {
      return 'v1'
    }
  }

  @Module({
    imports: [InertiaModule.forRoot({ vite: { hotFile }, ssr: { enabled: false } })],
    controllers: [RedirectController],
    providers: [{ provide: APP_FILTER, useClass: RecordingFilter }],
  })
  class RedirectModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      consumer.apply(VersionedMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
    }
  }

  it('does not let @Redirect() write to the already-sent 409', async () => {
    const app = await createApp(RedirectModule)

    try {
      await request(app.getHttpServer()).get('/old').set(inertiaHeaders({ version: 'stale' })).expect(409)
      expect(caught).toEqual([])
    } finally {
      await app.close()
    }
  })
})

describe('F5: page chunk preloading for any framework', () => {
  let root: string
  const cwd = process.cwd()

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nestjs-inertia-manifest-'))
    mkdirSync(join(root, 'public/build/.vite'), { recursive: true })
    writeFileSync(
      join(root, 'public/build/.vite/manifest.json'),
      JSON.stringify({
        'resources/js/app.ts': { file: 'assets/app.js', isEntry: true },
        'resources/js/Pages/Home.vue': { file: 'assets/Home.js' },
        'resources/js/Pages/Home/Nested.vue': { file: 'assets/Nested.js' },
      }),
    )
    process.chdir(root)
  })

  afterEach(() => {
    process.chdir(cwd)
    rmSync(root, { recursive: true, force: true })
  })

  it('finds the page chunk whatever its extension', () => {
    const vite = new Vite({ vite: { entry: ['resources/js/app.ts'] } })

    expect(vite.tags('Home')).toContain('<link rel="modulepreload" href="/build/assets/Home.js">')
    expect(vite.tags('Home')).not.toContain('Nested.js')
  })

  it('honours an explicit page extension', () => {
    const vite = new Vite({ vite: { entry: ['resources/js/app.ts'], pageExtension: '.tsx' } })
    expect(vite.tags('Home')).not.toContain('Home.js')
  })
})

describe('F8: ssr:start exit codes', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nestjs-inertia-ssr-'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(root, { recursive: true, force: true })
  })

  it('reports a server killed by a signal it did not forward as a failure', async () => {
    const bundle = join(root, 'app.js')
    writeFileSync(bundle, "process.kill(process.pid, 'SIGKILL')\n")

    expect(await startSsr({ bundle })).toBe(137)
  })

  it('passes through the exit code of a server that exits on its own', async () => {
    const bundle = join(root, 'app.js')
    writeFileSync(bundle, 'process.exit(3)\n')

    expect(await startSsr({ bundle })).toBe(3)
  })
})
