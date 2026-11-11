import { Link } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

export default function UrlFragments({ timestamp, redirectedFrom }: { timestamp: string; redirectedFrom: string | null }) {
  return (
    <>
      <PageHeader
        title="URL fragments"
        description="XHR redirects drop the #fragment. The adapter answers redirects to URLs with a fragment with 409 + X-Inertia-Redirect, and supports preserveFragment() to carry the original fragment across a redirect."
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="indigo">Rendered at {timestamp}</Badge>
        {redirectedFrom && <Badge tone="emerald">Redirected from {redirectedFrom}</Badge>}
      </div>

      <DemoCard title="Try it" className="mt-6">
        <div className="flex flex-wrap gap-2">
          <Link href="#section-2" className="btn-secondary">
            Jump to #section-2
          </Link>
          <Link href="/features/url-fragments/redirect-hash" className="btn-secondary">
            Server redirect to #server-section
          </Link>
          <Link href="/features/url-fragments/preserve-redirect#section-3" className="btn-secondary">
            Redirect preserving #section-3
          </Link>
        </div>
      </DemoCard>

      {['section-1', 'section-2', 'section-3', 'server-section'].map((id) => (
        <section key={id} id={id} className="card mt-6 flex h-[70vh] items-center justify-center text-lg font-semibold text-slate-400">
          #{id}
        </section>
      ))}
    </>
  )
}
