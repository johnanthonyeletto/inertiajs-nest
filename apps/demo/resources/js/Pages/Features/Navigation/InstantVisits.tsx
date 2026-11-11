import { Link } from '@inertiajs/react'
import { Badge, Code, DemoCard, PageHeader } from '@/Components/Demo'

export default function InstantVisits({ timestamp }: { timestamp: string }) {
  return (
    <>
      <PageHeader
        title="Instant visits"
        description="With a target component, Inertia swaps to the next page immediately and merges in the real props when the (deliberately slow) response arrives. Shared props carry over thanks to the sharedProps metadata the adapter emits."
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>
      <DemoCard title="Try it" className="mt-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/features/instant-visits/target?delay=2" component="Features/Navigation/InstantVisitTarget" className="btn-primary">
            Instant visit (2s server)
          </Link>
          <Link
            href="/features/instant-visits/target?delay=2"
            component="Features/Navigation/InstantVisitTarget"
            pageProps={(_current, shared) => ({ ...shared, greeting: 'Loading greeting…' })}
            className="btn-secondary"
          >
            With placeholder pageProps
          </Link>
          <Link href="/features/instant-visits/target?delay=2" className="btn-secondary">
            Regular visit (waits 2s)
          </Link>
        </div>
        <Code>{`<Link href="/features/instant-visits/target" component="Features/Navigation/InstantVisitTarget">`}</Code>
      </DemoCard>
    </>
  )
}
