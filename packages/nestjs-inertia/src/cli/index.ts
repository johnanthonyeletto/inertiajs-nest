import { parseArgs } from 'node:util'
import { type Framework, install } from './install.js'
import { checkSsr, startSsr, stopSsr } from './ssr.js'

const HELP = `Usage: nestjs-inertia <command> [options]

Commands:
  install       Scaffold Inertia into a NestJS app
                  --framework <react|vue|svelte>  --ssr | --no-ssr  --force  --yes  --dir <path>
  ssr:start     Run the production SSR server (bootstrap/ssr/app.js)
                  --bundle <path>  --runtime <node binary>
  ssr:stop      Stop the SSR server            --url <url>
  ssr:check     Check the SSR server is up     --url <url>

Environment: INERTIA_SSR_URL (default http://127.0.0.1:13714), INERTIA_SSR_BUNDLE.
`

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      framework: { type: 'string' },
      ssr: { type: 'boolean' },
      'no-ssr': { type: 'boolean' },
      force: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      dir: { type: 'string' },
      bundle: { type: 'string' },
      runtime: { type: 'string' },
      url: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  const [command] = positionals

  if (values.help || !command) {
    process.stdout.write(HELP)
    return command || values.help ? 0 : 1
  }

  switch (command) {
    case 'install': {
      const framework = values.framework === 'vue3' ? 'vue' : values.framework

      if (framework !== undefined && !['react', 'vue', 'svelte'].includes(framework)) {
        console.error(`Unknown framework "${values.framework}". Use react, vue, or svelte.`)
        return 1
      }

      return install({
        directory: values.dir,
        framework: framework as Framework | undefined,
        ssr: values['no-ssr'] ? false : values.ssr,
        force: values.force,
        yes: values.yes,
      })
    }
    case 'ssr:start':
      return startSsr({ bundle: values.bundle, runtime: values.runtime })
    case 'ssr:stop':
      return stopSsr({ url: values.url })
    case 'ssr:check':
      return checkSsr({ url: values.url })
    default:
      console.error(`Unknown command "${command}".\n`)
      process.stderr.write(HELP)
      return 1
  }
}

process.exitCode = await main(process.argv.slice(2))
