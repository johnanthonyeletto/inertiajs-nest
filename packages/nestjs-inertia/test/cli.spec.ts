import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { install } from '../src/cli/install.js'
import { checkSsr, stopSsr } from '../src/cli/ssr.js'

function capture() {
  const output = new PassThrough()
  let text = ''
  output.on('data', (chunk) => (text += chunk))

  return { output, text: () => text }
}

describe('nestjs-inertia install', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'inertia-nest-install-'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app', scripts: { build: 'nest build' } }, null, 2))
    writeFileSync(join(root, '.gitignore'), 'node_modules\n')
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('scaffolds a React app with SSR', async () => {
    const { output, text } = capture()

    expect(await install({ directory: root, framework: 'react', ssr: true, output })).toBe(0)

    for (const file of [
      'src/inertia/handle-inertia-requests.ts',
      'src/home.controller.ts',
      'resources/js/app.tsx',
      'resources/js/Pages/Home.tsx',
      'vite.config.ts',
      'tsconfig.client.json',
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true)
    }

    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toContain("import react from '@vitejs/plugin-react'")
    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toContain("nestInertia({ input: 'resources/js/app.tsx' })")
    expect(readFileSync(join(root, 'resources/js/app.tsx'), 'utf8')).toContain('my-app')
    expect(readFileSync(join(root, 'tsconfig.client.json'), 'utf8')).toContain('"jsx": "react-jsx"')

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.scripts).toMatchObject({ build: 'nest build', 'build:ssr': 'vite build --ssr', 'ssr:start': 'nestjs-inertia ssr:start' })
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('node_modules\npublic/hot\npublic/build/\nbootstrap/ssr/\n')
    expect(text()).toContain('npm install -D vite @inertiajs/vite @inertiajs/react')
  })

  it('scaffolds Vue without SSR and keeps existing files', async () => {
    writeFileSync(join(root, 'vite.config.ts'), '// mine\n')
    const { output, text } = capture()

    await install({ directory: root, framework: 'vue', ssr: false, output })

    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toBe('// mine\n')
    expect(readFileSync(join(root, 'resources/js/Pages/Home.vue'), 'utf8')).toContain('{{ message }}')
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts).not.toHaveProperty('build:ssr')
    expect(text()).toContain('skipped  vite.config.ts')
    expect(text()).toContain("ssr: { enabled: false }")
    expect(text()).toContain("reactRefresh: false")
  })

  it('prompts for the framework and SSR', async () => {
    const input = new PassThrough()
    const { output } = capture()
    const done = install({ directory: root, input, output })

    input.write('svelte\n')
    setTimeout(() => input.write('n\n'), 20)

    expect(await done).toBe(0)
    expect(existsSync(join(root, 'resources/js/Pages/Home.svelte'))).toBe(true)
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts).not.toHaveProperty('ssr:start')
  })

  it('refuses to run outside a project', async () => {
    const { output } = capture()
    expect(await install({ directory: join(root, 'missing'), output, yes: true })).toBe(1)
  })
})

describe('nestjs-inertia ssr:check and ssr:stop', () => {
  let server: Server
  let url: string
  let shutdowns = 0

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/health') return res.end(JSON.stringify({ status: 'OK' }))
      if (req.url === '/shutdown') {
        shutdowns++
        return req.socket.destroy()
      }
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => server.close())

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('reports whether the server is healthy', async () => {
    expect(await checkSsr({ url })).toBe(0)
    expect(await checkSsr({ url: 'http://127.0.0.1:1', timeout: 500 })).toBe(1)
  })

  it('asks the server to shut down, tolerating the dropped connection', async () => {
    expect(await stopSsr({ url })).toBe(0)
    expect(shutdowns).toBe(1)
    expect(await stopSsr({ url: 'http://127.0.0.1:1', timeout: 500 })).toBe(1)
  })
})
