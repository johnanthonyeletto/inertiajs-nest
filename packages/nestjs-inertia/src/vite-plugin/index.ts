/**
 * Vite integration (`inertia-nest/vite`). Use it next to `@inertiajs/vite`:
 *
 * ```ts
 * import inertia from '@inertiajs/vite'
 * import nestInertia from 'inertia-nest/vite'
 *
 * export default defineConfig({
 *   plugins: [inertia(), react(), nestInertia({ input: 'resources/js/app.tsx' })],
 * })
 * ```
 *
 * `@inertiajs/vite` serves dev SSR at `/__inertia_ssr` but has no way to tell
 * the server that the dev server is running. This plugin writes a hot file
 * (like laravel-vite-plugin) with the dev server's URL; the adapter reads it
 * to load assets from Vite with HMR and to server-render through it. It also
 * applies the build defaults the adapter's asset resolver expects.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { type Plugin, type ResolvedConfig, type UserConfig, version as viteVersion } from 'vite'

export interface NestInertiaPluginOptions {
  /** Client entry point(s). Defaults to `resources/js/app.tsx`. */
  input?: string | string[]
  /** Directory served at the web root. Defaults to `public`. */
  publicDirectory?: string
  /** Build output directory, relative to the public directory. Defaults to `build`. */
  buildDirectory?: string
  /** Where to write the dev server's URL. Defaults to `<publicDirectory>/hot`. */
  hotFile?: string
  /** Output directory of the SSR bundle (`vite build --ssr`). Defaults to `bootstrap/ssr`. */
  ssrOutputDirectory?: string
}

export default function nestInertia(options: NestInertiaPluginOptions = {}): Plugin {
  const publicDirectory = options.publicDirectory ?? 'public'
  const buildDirectory = options.buildDirectory ?? 'build'
  const hotFile = resolve(options.hotFile ?? join(publicDirectory, 'hot'))
  const input = options.input ?? 'resources/js/app.tsx'
  let resolved: ResolvedConfig | undefined

  const removeHotFile = () => {
    if (existsSync(hotFile)) rmSync(hotFile)
  }

  return {
    name: 'inertia-nest',

    config(config, { command, isSsrBuild }): UserConfig {
      const ssr = Boolean(isSsrBuild ?? config.build?.ssr)

      return {
        // Built assets are served by Nest from `<publicDirectory>/<buildDirectory>`.
        base: config.base ?? (command === 'build' ? `/${buildDirectory}/` : '/'),
        // The public directory is served by Nest, not copied by Vite.
        publicDir: config.publicDir ?? false,
        build: ssr
          ? {
              outDir: config.build?.outDir ?? options.ssrOutputDirectory ?? 'bootstrap/ssr',
              emptyOutDir: config.build?.emptyOutDir ?? true,
            }
          : {
              outDir: config.build?.outDir ?? join(publicDirectory, buildDirectory),
              emptyOutDir: config.build?.emptyOutDir ?? true,
              manifest: config.build?.manifest ?? true,
              ...(hasInput(config) ? {} : { [BUNDLER_OPTIONS]: { input } }),
            },
        server: {
          // Pages are served by Nest on another origin.
          cors: config.server?.cors ?? { origin: /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/ },
        },
      }
    },

    configResolved(config) {
      resolved = config
    },

    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | string | null
        const url = devServerUrl(resolved, address)

        if (url) {
          mkdirSync(dirname(hotFile), { recursive: true })
          writeFileSync(hotFile, url)
        }
      })

      server.httpServer?.once('close', removeHotFile)
      process.once('exit', removeHotFile)

      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        process.once(signal, () => process.exit())
      }
    },
  }
}

// Vite 8 bundles with Rolldown and renamed `build.rollupOptions`.
const BUNDLER_OPTIONS = Number(viteVersion.split('.')[0]) >= 8 ? 'rolldownOptions' : 'rollupOptions'

function hasInput(config: UserConfig): boolean {
  const build = config.build as Record<string, { input?: unknown } | undefined> | undefined

  return Boolean(build?.rolldownOptions?.input ?? build?.rollupOptions?.input)
}

function devServerUrl(config: ResolvedConfig | undefined, address: AddressInfo | string | null): string | null {
  if (config?.server.origin) {
    return config.server.origin.replace(/\/$/, '')
  }

  if (!address || typeof address === 'string') {
    return null
  }

  const protocol = config?.server.https ? 'https' : 'http'
  const host = address.family === 'IPv6' ? `[${address.address}]` : address.address
  const reachableHost = ['::', '0.0.0.0', '[::]', '::1', '[::1]'].includes(host) ? 'localhost' : host

  return `${protocol}://${reachableHost}:${address.port}`
}

export { nestInertia }
