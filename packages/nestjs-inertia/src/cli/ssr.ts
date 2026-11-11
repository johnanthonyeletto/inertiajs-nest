import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { constants } from 'node:os'
import { resolve } from 'node:path'
import { DEFAULT_SSR_BUNDLE, DEFAULT_SSR_URL } from '../constants.js'

export interface SsrCommandOptions {
  url?: string
  bundle?: string
  runtime?: string
  timeout?: number
}

const ssrUrl = (options: SsrCommandOptions) =>
  (options.url ?? process.env.INERTIA_SSR_URL ?? DEFAULT_SSR_URL).replace(/\/$/, '')

/**
 * Runs the production SSR bundle (built with `vite build --ssr`) in the
 * foreground, forwarding signals and the exit code, like Laravel's
 * `inertia:start-ssr`. Use a process manager to keep it running.
 */
export function startSsr(options: SsrCommandOptions = {}): Promise<number> {
  const bundle = resolve(options.bundle ?? process.env.INERTIA_SSR_BUNDLE ?? DEFAULT_SSR_BUNDLE)

  if (!existsSync(bundle)) {
    console.error(`Inertia SSR bundle not found at ${bundle}. Build it with "vite build --ssr".`)
    return Promise.resolve(1)
  }

  const child = spawn(options.runtime ?? process.execPath, [bundle], { stdio: 'inherit' })
  let forwarded: NodeJS.Signals | null = null
  const forward = (signal: NodeJS.Signals) => () => {
    forwarded = signal
    child.kill(signal)
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, forward(signal))
  }

  return new Promise((resolvePromise) => {
    child.on('error', (error) => {
      console.error(`Failed to start the SSR server: ${error.message}`)
      resolvePromise(1)
    })
    // Stopping on our own signal is a clean exit; any other signal (OOM
    // kill, abort) must look like a failure to process managers.
    child.on('exit', (code, signal) =>
      resolvePromise(code ?? (signal === forwarded ? 0 : 128 + (signal ? (constants.signals[signal] ?? 0) : 1))),
    )
  })
}

/** Asks a running SSR server to exit via its `/shutdown` endpoint. */
export async function stopSsr(options: SsrCommandOptions = {}): Promise<number> {
  const url = ssrUrl(options)

  if (!(await isHealthy(url, options.timeout))) {
    console.error(`No Inertia SSR server is running at ${url}.`)
    return 1
  }

  try {
    await fetch(`${url}/shutdown`, { signal: AbortSignal.timeout(options.timeout ?? 5000) })
  } catch {
    // The server exits without answering, so a dropped connection is expected.
  }

  console.log('Inertia SSR server stopped.')
  return 0
}

/** Exits with 0 when the SSR server answers its `/health` endpoint, 1 otherwise. */
export async function checkSsr(options: SsrCommandOptions = {}): Promise<number> {
  const url = ssrUrl(options)

  if (await isHealthy(url, options.timeout)) {
    console.log(`Inertia SSR server is running at ${url}.`)
    return 0
  }

  console.error(`Inertia SSR server is not running at ${url}.`)
  return 1
}

async function isHealthy(url: string, timeout = 5000): Promise<boolean> {
  try {
    return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeout) })).ok
  } catch {
    return false
  }
}
