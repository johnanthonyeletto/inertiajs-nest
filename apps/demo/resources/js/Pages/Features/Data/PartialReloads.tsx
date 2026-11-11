import { router } from '@inertiajs/react'
import { Code, DemoCard, Json, PageHeader } from '@/Components/Demo'

interface Props {
  users: { id: number; name: string }[]
  stats: { contacts: number; organizations: number }
  timestamp: string
  randomNumber: number
  serverTime: string
}

export default function PartialReloads(props: Props) {
  const reload = (options: { only?: string[]; except?: string[] }) => router.reload(options)

  return (
    <>
      <PageHeader
        title="Partial reloads"
        description="Reloads of the same component can request a subset of props (X-Inertia-Partial-Data / -Except). Props defined as closures are only evaluated when included; serverTime is an always prop and is sent every time."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Reload">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => reload({ only: ['randomNumber'] })}>
              only randomNumber
            </button>
            <button type="button" className="btn-secondary" onClick={() => reload({ only: ['timestamp', 'stats'] })}>
              only timestamp + stats
            </button>
            <button type="button" className="btn-secondary" onClick={() => reload({ except: ['users', 'stats'] })}>
              except users + stats
            </button>
            <button type="button" className="btn-secondary" onClick={() => reload({})}>
              everything
            </button>
          </div>
          <Code>{`router.reload({ only: ['randomNumber'] })`}</Code>
        </DemoCard>
        <DemoCard title="Current props" description="Open the network tab to compare response sizes.">
          <Json value={props} />
        </DemoCard>
      </div>
    </>
  )
}
