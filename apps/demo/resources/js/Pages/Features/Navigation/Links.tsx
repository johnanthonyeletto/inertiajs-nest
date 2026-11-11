import { Link } from '@inertiajs/react'
import { useState } from 'react'
import { Badge, Code, DemoCard, PageHeader } from '@/Components/Demo'

export default function Links({ timestamp }: { timestamp: string }) {
  const [counter, setCounter] = useState(0)

  return (
    <>
      <PageHeader
        title="Links"
        description="The <Link> component intercepts clicks and performs Inertia visits: an XHR request with X-Inertia: true that returns a JSON page object instead of HTML."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="indigo">Server timestamp: {timestamp}</Badge>
        <Badge tone="emerald">Local counter: {counter}</Badge>
        <button type="button" className="btn-secondary" onClick={() => setCounter((value) => value + 1)}>
          Increment local counter
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="State & scroll" description="By default a visit remounts the page (resetting local state) and scrolls to the top.">
          <div className="flex flex-wrap gap-2">
            <Link href="/features/links" className="btn-secondary">
              Plain visit
            </Link>
            <Link href="/features/links" preserveState className="btn-secondary">
              preserveState
            </Link>
            <Link href="/features/links" preserveScroll className="btn-secondary">
              preserveScroll
            </Link>
            <Link href="/features/links" only={['timestamp']} preserveState className="btn-secondary">
              only: ['timestamp']
            </Link>
            <Link href="/features/links" replace className="btn-secondary">
              replace (no history entry)
            </Link>
          </div>
          <Code>{`<Link href="/features/links" only={['timestamp']} preserveState>`}</Code>
        </DemoCard>

        <DemoCard
          title="HTTP methods"
          description="Non-GET links render as buttons. The server flashes a message and redirects back; after PUT/PATCH/DELETE the adapter answers with 303 so the browser follows with a GET."
        >
          <div className="flex flex-wrap gap-2">
            {(['post', 'put', 'patch', 'delete'] as const).map((method) => (
              <Link key={method} href="/features/links" method={method} as="button" data={{ source: 'links-demo' }} preserveScroll className="btn-secondary uppercase">
                {method}
              </Link>
            ))}
          </div>
          <Code>{`<Link href="/features/links" method="delete" as="button" data={{ source: 'links-demo' }}>`}</Code>
        </DemoCard>

        <DemoCard title="Headers & view transitions">
          <div className="flex flex-wrap gap-2">
            <Link href="/features/links" headers={{ 'X-Custom-Header': 'hello' }} className="btn-secondary">
              Custom header
            </Link>
            <Link href="/features/links" viewTransition className="btn-secondary">
              With view transition
            </Link>
            <Link href="/features/links#bottom" className="btn-secondary">
              Link with #fragment
            </Link>
          </div>
        </DemoCard>

        <DemoCard title="Active states" description="usePage().url drives the active link styling in the sidebar.">
          <p className="text-sm text-slate-600">
            The sidebar highlights the current page by comparing each link with <code className="inline">usePage().url</code>.
          </p>
        </DemoCard>
      </div>

      <div id="bottom" className="mt-[60vh] text-sm text-slate-400">
        #bottom — fragment target
      </div>
    </>
  )
}
