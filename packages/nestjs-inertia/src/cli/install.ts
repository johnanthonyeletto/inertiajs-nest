import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

export type Framework = 'react' | 'vue' | 'svelte'

export interface InstallOptions {
  /** Project root. Defaults to the current directory. */
  directory?: string
  framework?: Framework
  ssr?: boolean
  /** Overwrite existing files. */
  force?: boolean
  /** Accept defaults instead of prompting. */
  yes?: boolean
  /** Prompt input/output (for tests). */
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
}

interface FrameworkSetup {
  entry: string
  pages: [stub: string, target: string][]
  frameworkImport: string
  frameworkPlugin: string
  jsx: boolean
  dependencies: string[]
}

const FRAMEWORKS: Record<Framework, FrameworkSetup> = {
  react: {
    entry: 'resources/js/app.tsx',
    pages: [
      ['react/app.tsx', 'resources/js/app.tsx'],
      ['react/Pages/Home.tsx', 'resources/js/Pages/Home.tsx'],
    ],
    frameworkImport: "import react from '@vitejs/plugin-react'",
    frameworkPlugin: 'react()',
    jsx: true,
    dependencies: ['@inertiajs/react', 'react', 'react-dom', '@vitejs/plugin-react', '@types/react', '@types/react-dom'],
  },
  vue: {
    entry: 'resources/js/app.ts',
    pages: [
      ['vue/app.ts', 'resources/js/app.ts'],
      ['vue/Pages/Home.vue', 'resources/js/Pages/Home.vue'],
    ],
    frameworkImport: "import vue from '@vitejs/plugin-vue'",
    frameworkPlugin: 'vue()',
    jsx: false,
    dependencies: ['@inertiajs/vue3', 'vue', '@vitejs/plugin-vue'],
  },
  svelte: {
    entry: 'resources/js/app.ts',
    pages: [
      ['svelte/app.ts', 'resources/js/app.ts'],
      ['svelte/Pages/Home.svelte', 'resources/js/Pages/Home.svelte'],
    ],
    frameworkImport: "import { svelte } from '@sveltejs/vite-plugin-svelte'",
    frameworkPlugin: 'svelte()',
    jsx: false,
    dependencies: ['@inertiajs/svelte', 'svelte', '@sveltejs/vite-plugin-svelte'],
  },
}

const STUBS = resolve(dirname(fileURLToPath(import.meta.url)), '../../stubs')

/**
 * Scaffolds Inertia into a NestJS app: the middleware subclass, a home
 * controller, the client entry and first page, `vite.config.ts`, a client
 * tsconfig, npm scripts, and `.gitignore` entries. Existing files are kept
 * unless `force` is set; nothing else is edited. Prints the remaining steps.
 */
export async function install(options: InstallOptions = {}): Promise<number> {
  const root = resolve(options.directory ?? process.cwd())
  const output = options.output ?? process.stdout
  const log = (line = '') => output.write(`${line}\n`)

  if (!existsSync(join(root, 'package.json'))) {
    log(`No package.json found in ${root}. Run this from your NestJS project's root.`)
    return 1
  }

  const { framework, ssr } = await ask(options)
  const setup = FRAMEWORKS[framework]
  const appName = readPackageJson(root).name ?? 'App'
  const created: string[] = []
  const skipped: string[] = []

  const write = (target: string, contents: string) => {
    const path = join(root, target)

    if (existsSync(path) && !options.force) {
      skipped.push(target)
      return
    }

    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, contents)
    created.push(target)
  }

  const stub = (name: string, values: Record<string, string> = {}) =>
    Object.entries(values).reduce(
      (contents, [key, value]) => contents.replaceAll(`{{${key}}}`, value),
      readFileSync(join(STUBS, name), 'utf8'),
    )

  write('src/inertia/handle-inertia-requests.ts', stub('handle-inertia-requests.ts.stub'))
  write('src/home.controller.ts', stub('home.controller.ts.stub'))

  for (const [source, target] of setup.pages) {
    write(target, stub(source, { appName }))
  }

  write(
    'vite.config.ts',
    stub('vite.config.ts.stub', {
      frameworkImport: setup.frameworkImport,
      frameworkPlugin: setup.frameworkPlugin,
      entry: setup.entry,
    }),
  )
  write('tsconfig.client.json', stub('tsconfig.client.json.stub', { jsx: setup.jsx ? '    "jsx": "react-jsx",\n' : '' }))

  const scripts = addScripts(root, {
    'dev:client': 'vite',
    'build:client': 'vite build',
    ...(ssr ? { 'build:ssr': 'vite build --ssr', 'ssr:start': 'nestjs-inertia ssr:start' } : {}),
  })
  const ignored = addGitignoreEntries(root, ['public/hot', 'public/build/', ...(ssr ? ['bootstrap/ssr/'] : [])])

  log()
  log('Inertia scaffolding')
  created.forEach((file) => log(`  created  ${file}`))
  skipped.forEach((file) => log(`  skipped  ${file} (exists; use --force to overwrite)`))
  scripts.forEach((script) => log(`  added    npm script "${script}"`))
  ignored.forEach((entry) => log(`  ignored  ${entry}`))
  log()
  log('Next steps:')
  log()
  log('1. Install the dependencies:')
  log()
  log('     npm install express-session')
  log(`     npm install -D vite @inertiajs/vite ${setup.dependencies.join(' ')} @types/express-session`)
  log()
  log('2. Register Inertia in your root module:')
  log()
  log(
    [
      "     import { APP_FILTER } from '@nestjs/core'",
      "     import session from 'express-session'",
      "     import { InertiaExceptionFilter, InertiaModule } from 'inertia-nest'",
      "     import { HandleInertiaRequests } from './inertia/handle-inertia-requests.js'",
      "     import { HomeController } from './home.controller.js'",
      '',
      '     @Module({',
      `       imports: [InertiaModule.forRoot({ vite: { entry: ['${setup.entry}']${setup.jsx ? '' : ', reactRefresh: false'} }${ssr ? '' : ', ssr: { enabled: false }'} })],`,
      '       controllers: [HomeController],',
      '       providers: [{ provide: APP_FILTER, useClass: InertiaExceptionFilter }],',
      '     })',
      '     export class AppModule implements NestModule {',
      '       configure(consumer: MiddlewareConsumer) {',
      "         consumer.apply(session({ secret: process.env.APP_KEY!, resave: false, saveUninitialized: false }), HandleInertiaRequests).forRoutes('*')",
      '       }',
      '     }',
    ].join('\n'),
  )
  log()
  log("3. Serve public/ in main.ts: app.useStaticAssets('public', { index: false }) (NestExpressApplication).")
  log('4. Keep the client code out of the server build: add "resources" and "vite.config.ts" to "exclude" in tsconfig.build.json.')
  log(`5. Run "npm run dev:client" next to your Nest dev server${ssr ? ', or build with "npm run build:client && npm run build:ssr" and start the SSR server with "npm run ssr:start"' : ''}.`)
  log()

  return 0
}

async function ask(options: InstallOptions): Promise<{ framework: Framework; ssr: boolean }> {
  let framework = options.framework
  let ssr = options.ssr
  const input = options.input ?? process.stdin
  const interactive = !options.yes && (options.input !== undefined || (process.stdin.isTTY ?? false))

  if (interactive && (framework === undefined || ssr === undefined)) {
    const prompt = createInterface({ input, output: options.output ?? process.stdout })

    try {
      while (framework === undefined) {
        const answer = (await prompt.question('Which framework? (react/vue/svelte) [react] ')).trim().toLowerCase()
        const choice = answer === '' ? 'react' : answer === 'vue3' ? 'vue' : answer

        if (choice in FRAMEWORKS) framework = choice as Framework
      }

      if (ssr === undefined) {
        ssr = !/^n/i.test((await prompt.question('Enable server-side rendering? (Y/n) ')).trim())
      }
    } finally {
      prompt.close()
    }
  }

  return { framework: framework ?? 'react', ssr: ssr ?? true }
}

function readPackageJson(root: string): { name?: string; scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string; scripts?: Record<string, string> }
}

function addScripts(root: string, scripts: Record<string, string>): string[] {
  const path = join(root, 'package.json')
  const raw = readFileSync(path, 'utf8')
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
  const added = Object.keys(scripts).filter((name) => pkg.scripts?.[name] === undefined)

  if (added.length > 0) {
    pkg.scripts = { ...pkg.scripts, ...Object.fromEntries(added.map((name) => [name, scripts[name]])) }
    const indent = raw.match(/^[ \t]+(?=")/m)?.[0] ?? '  '
    writeFileSync(path, `${JSON.stringify(pkg, null, indent)}\n`)
  }

  return added
}

function addGitignoreEntries(root: string, entries: string[]): string[] {
  const path = join(root, '.gitignore')

  if (!existsSync(path)) {
    return []
  }

  const current = readFileSync(path, 'utf8')
  const lines = new Set(current.split(/\r?\n/).map((line) => line.trim()))
  const missing = entries.filter((entry) => !lines.has(entry) && !lines.has(entry.replace(/\/$/, '')))

  if (missing.length > 0) {
    writeFileSync(path, `${current.replace(/\n?$/, '\n')}${missing.join('\n')}\n`)
  }

  return missing
}

