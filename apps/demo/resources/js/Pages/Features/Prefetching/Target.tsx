import { Link, usePrefetch } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

export default function Target({ id, timestamp, value }: { id: number; timestamp: string; value: number }) {
  const { isPrefetched, isPrefetching, lastUpdatedAt, flush } = usePrefetch()

  return (
    <>
      <PageHeader title={`Prefetch target #${id}`} description="usePrefetch() reports the cache state of the current page." />
      <div className="flex flex-wrap gap-2">
        <Badge tone="indigo">Generated at {timestamp}</Badge>
        <Badge>Value {value}</Badge>
        <Badge tone={isPrefetched ? 'emerald' : 'slate'}>isPrefetched: {String(isPrefetched)}</Badge>
        <Badge tone={isPrefetching ? 'amber' : 'slate'}>isPrefetching: {String(isPrefetching)}</Badge>
        {lastUpdatedAt && <Badge>cached at {new Date(lastUpdatedAt).toLocaleTimeString()}</Badge>}
      </div>
      <DemoCard title="Navigate" className="mt-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/features/prefetching" className="btn-secondary">
            ← Back to prefetching
          </Link>
          <button type="button" className="btn-secondary" onClick={flush} disabled={!isPrefetched}>
            Flush this page from the cache
          </button>
        </div>
      </DemoCard>
    </>
  )
}
