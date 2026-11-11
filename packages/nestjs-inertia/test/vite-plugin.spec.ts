import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, resolveConfig } from 'vite'
import nestInertia from '../src/vite-plugin/index.js'

describe('inertia-nest/vite', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'inertia-nest-vite-'))
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('applies the build layout the asset resolver expects', async () => {
    const client = await resolveConfig({ root, configFile: false, plugins: [nestInertia({ input: 'resources/js/app.ts' })] }, 'build')

    expect(client.base).toBe('/build/')
    expect(client.publicDir).toBe('')
    expect(client.build.outDir).toBe('public/build')
    expect(client.build.manifest).toBe(true)
    expect((client.build.rolldownOptions ?? client.build.rollupOptions).input).toBe('resources/js/app.ts')
    expect(client.optimizeDeps.entries).toEqual(['resources/js/app.ts', 'resources/js/**/*.{js,jsx,ts,tsx,vue,svelte}'])

    const ssr = await resolveConfig(
      { root, configFile: false, build: { ssr: 'resources/js/app.ts' }, plugins: [nestInertia()] },
      'build',
    )
    expect(ssr.build.outDir).toBe('bootstrap/ssr')
  })

  it('writes the hot file while the dev server runs and removes it afterwards', async () => {
    const hotFile = join(root, 'public/hot')
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, host: '127.0.0.1' },
      plugins: [nestInertia({ hotFile })],
    })

    await server.listen()
    const address = server.httpServer!.address() as { port: number }

    expect(readFileSync(hotFile, 'utf8')).toBe(`http://127.0.0.1:${address.port}`)

    await server.close()
    expect(existsSync(hotFile)).toBe(false)
  })
})
