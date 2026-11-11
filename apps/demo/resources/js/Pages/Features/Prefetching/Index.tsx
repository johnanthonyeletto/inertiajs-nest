import { Link, router } from '@inertiajs/react'
import { Badge, Code, DemoCard, PageHeader } from '@/Components/Demo'

const examples = [
  { id: 1, label: 'Hover (75ms)', props: { prefetch: true } },
  { id: 2, label: 'On mount', props: { prefetch: 'mount' as const } },
  { id: 3, label: 'On mousedown', props: { prefetch: 'click' as const } },
  { id: 4, label: 'Hover, cached 5s', props: { prefetch: true, cacheFor: '5s' } },
  { id: 5, label: 'Stale-while-revalidate (5s fresh, 1m stale)', props: { prefetch: true, cacheFor: ['5s', '1m'] } },
  { id: 6, label: 'Tagged "reports"', props: { prefetch: true, cacheTags: 'reports' } },
]

export default function Index({ timestamp }: { timestamp: string }) {
  return (
    <>
      <PageHeader
        title="Prefetching"
        description="Each target page takes 800ms on the server. Prefetched responses (sent with Purpose: prefetch) are cached on the client, so the visit itself is instant. Note the timestamp on the target to see when it was generated."
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DemoCard title="<Link prefetch>">
          <ul className="space-y-2">
            {examples.map((example) => (
              <li key={example.id}>
                <Link href={`/features/prefetching/pages/${example.id}`} {...example.props} className="link text-sm">
                  {example.label} →
                </Link>
              </li>
            ))}
          </ul>
        </DemoCard>
        <DemoCard title="Programmatic" description="router.prefetch() and cache invalidation.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.prefetch('/features/prefetching/pages/7', { method: 'get' }, { cacheFor: '1m', cacheTags: 'reports' })}>
              router.prefetch(page 7)
            </button>
            <Link href="/features/prefetching/pages/7" className="btn-secondary">
              Visit page 7
            </Link>
            <button type="button" className="btn-secondary" onClick={() => router.flushByCacheTags('reports')}>
              flushByCacheTags('reports')
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.flushAll()}>
              flushAll()
            </button>
          </div>
          <Code>{`<Link href="/reports" prefetch cacheFor={['5s', '1m']} cacheTags="reports">`}</Code>
        </DemoCard>
      </div>
    </>
  )
}
