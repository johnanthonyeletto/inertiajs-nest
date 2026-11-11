import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix, resolve } from 'node:path'
import { Inject, Injectable } from '@nestjs/common'
import { INERTIA_CONFIG } from './constants.js'
import type { InertiaConfig } from './config.js'

interface ManifestChunk {
  file: string
  src?: string
  isEntry?: boolean
  imports?: string[]
  css?: string[]
}

type Manifest = Record<string, ManifestChunk>

/**
 * Resolves the asset tags for the root view. While the Vite dev server runs
 * (signalled by the hot file) assets are loaded from it with HMR; otherwise
 * they are read from the production build manifest.
 */
@Injectable()
export class Vite {
  private readonly entries: string[]
  private readonly hotFile: string
  private readonly buildDirectory: string
  private readonly manifestPath: string
  private readonly reactRefresh: boolean
  private readonly pagesDirectory: string
  private readonly pageExtension: string | null
  private cache: { mtimeMs: number; manifest: Manifest; hash: string } | null = null

  constructor(@Inject(INERTIA_CONFIG) config: InertiaConfig) {
    const vite = config.vite ?? {}
    const publicDirectory = resolve(vite.publicDirectory ?? 'public')

    this.entries = vite.entry ?? ['resources/js/app.tsx']
    this.hotFile = resolve(vite.hotFile ?? join(publicDirectory, 'hot'))
    this.buildDirectory = vite.buildDirectory ?? 'build'
    this.manifestPath = join(publicDirectory, this.buildDirectory, '.vite', 'manifest.json')
    this.reactRefresh = vite.reactRefresh ?? true
    this.pagesDirectory = vite.pagesDirectory ?? 'resources/js/Pages'
    this.pageExtension = vite.pageExtension ?? null
  }

  /** The dev server URL, when `vite` (dev) is running. */
  hotUrl(): string | null {
    return existsSync(this.hotFile) ? readFileSync(this.hotFile, 'utf8').trim().replace(/\/$/, '') : null
  }

  /** A hash of the build manifest, used as the default Inertia asset version. */
  manifestHash(): string | null {
    return this.isRunningHot() ? null : (this.loadManifest()?.hash ?? null)
  }

  isRunningHot(): boolean {
    return existsSync(this.hotFile)
  }

  /** Script, stylesheet, and preload tags for the entry points and the current page. */
  tags(component?: string): string {
    const hot = this.hotUrl()

    if (hot) {
      const refresh = this.reactRefresh
        ? `<script type="module">import { injectIntoGlobalHook } from "${hot}/@react-refresh";` +
          `injectIntoGlobalHook(window);window.$RefreshReg$ = () => {};window.$RefreshSig$ = () => (type) => type;</script>`
        : ''

      return [
        refresh,
        `<script type="module" src="${hot}/@vite/client"></script>`,
        ...this.entries.map((entry) => `<script type="module" src="${hot}/${entry}"></script>`),
      ].join('\n    ')
    }

    const loaded = this.loadManifest()

    if (!loaded) {
      throw new Error(
        `Vite manifest not found at ${this.manifestPath}. Run "npm run build" or start the dev server with "npm run dev".`,
      )
    }

    const { manifest } = loaded
    const styles = new Set<string>()
    const preloads = new Set<string>()
    const scripts: string[] = []

    const collect = (key: string, seen = new Set<string>()) => {
      const chunk = manifest[key]
      if (!chunk || seen.has(key)) return
      seen.add(key)

      chunk.css?.forEach((css) => styles.add(this.url(css)))
      chunk.imports?.forEach((imported) => {
        const importedChunk = manifest[imported]
        if (importedChunk) preloads.add(this.url(importedChunk.file))
        collect(imported, seen)
      })
    }

    for (const entry of this.entries) {
      const chunk = manifest[entry]

      if (!chunk) {
        throw new Error(`Unable to locate "${entry}" in the Vite manifest.`)
      }

      scripts.push(this.url(chunk.file))
      collect(entry)
    }

    // Preload the current page's lazily-loaded chunk to avoid a request waterfall.
    const pageKey = component && this.pageKey(manifest, component)

    if (pageKey && manifest[pageKey]) {
      preloads.add(this.url(manifest[pageKey].file))
      collect(pageKey)
    }

    scripts.forEach((script) => preloads.delete(script))

    return [
      ...[...styles].map((href) => `<link rel="stylesheet" href="${href}">`),
      ...[...preloads].map((href) => `<link rel="modulepreload" href="${href}">`),
      ...scripts.map((src) => `<script type="module" src="${src}"></script>`),
    ].join('\n    ')
  }

  /** The manifest key of a page component, with the configured extension or any extension. */
  private pageKey(manifest: Manifest, component: string): string | undefined {
    const base = posix.join(this.pagesDirectory, component)

    if (this.pageExtension !== null) {
      return `${base}${this.pageExtension}`
    }

    return Object.keys(manifest).find((key) => key.startsWith(`${base}.`) && !key.slice(base.length + 1).includes('/'))
  }

  private url(file: string): string {
    return `/${posix.join(this.buildDirectory, file)}`
  }

  private loadManifest(): { manifest: Manifest; hash: string } | null {
    if (!existsSync(this.manifestPath)) {
      return null
    }

    const { mtimeMs } = statSync(this.manifestPath)

    if (this.cache?.mtimeMs !== mtimeMs) {
      const contents = readFileSync(this.manifestPath, 'utf8')
      let manifest: Manifest

      try {
        manifest = JSON.parse(contents) as Manifest
      } catch (error) {
        // Mid-deploy the manifest may be half-written: keep serving the
        // previous one until the file is complete.
        if (this.cache) return this.cache
        throw error
      }

      this.cache = { mtimeMs, manifest, hash: createHash('md5').update(contents).digest('hex') }
    }

    return this.cache
  }
}
