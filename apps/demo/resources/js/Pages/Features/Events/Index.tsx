import type { GlobalEventNames } from '@inertiajs/core'
import { Link, router } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

const EVENTS: GlobalEventNames[] = ['before', 'start', 'progress', 'success', 'error', 'finish', 'navigate', 'prefetching', 'prefetched', 'flash', 'httpException']

export default function Index({ timestamp }: { timestamp: string }) {
  const [log, setLog] = useState<string[]>([])
  const [confirmVisits, setConfirmVisits] = useState(false)

  useEffect(() => {
    // router.on() returns an unsubscribe function, used as the effect cleanup.
    const listeners = EVENTS.map((name) =>
      router.on(name, () => setLog((current) => [`${new Date().toLocaleTimeString()}  ${name}`, ...current].slice(0, 30))),
    )

    return () => listeners.forEach((unsubscribe) => unsubscribe())
  }, [])

  useEffect(() => {
    if (!confirmVisits) return

    // Returning false from a `before` listener cancels the visit.
    return router.on('before', (event) => {
      if (event.detail.visit.method !== 'get' || event.detail.visit.prefetch) return
      return confirm(`Visit ${event.detail.visit.url.pathname}?`)
    })
  }, [confirmVisits])

  return (
    <>
      <PageHeader
        title="Events & progress"
        description="Global router events (router.on / document 'inertia:*' events), cancellable visits, and the progress indicator. The demo visits use preserveState so this page (and its log) isn't remounted."
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DemoCard title="Trigger some events">
          <div className="flex flex-wrap gap-2">
            <Link href="/features/events" preserveState preserveScroll className="btn-secondary">
              Visit
            </Link>
            <Link href="/features/events/slow" preserveState preserveScroll className="btn-secondary">
              Slow visit (progress bar)
            </Link>
            <button type="button" className="btn-secondary" onClick={() => router.visit('/features/events/slow', { preserveState: true, preserveScroll: true, showProgress: false })}>
              Slow visit, no progress
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.post('/features/events/action', {}, { preserveState: true, preserveScroll: true })}>
              POST (flashes)
            </button>
            <Link href="/features/links" prefetch="hover" className="btn-secondary">
              Hover to prefetch
            </Link>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={confirmVisits} onChange={(e) => setConfirmVisits(e.target.checked)} />
            Confirm every GET visit (cancel from a <code className="inline">before</code> listener)
          </label>
        </DemoCard>
        <DemoCard title="Event log">
          <button type="button" className="btn-secondary mb-3" onClick={() => setLog([])}>
            Clear
          </button>
          <ol className="max-h-80 space-y-0.5 overflow-y-auto font-mono text-xs text-slate-600">
            {log.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ol>
        </DemoCard>
      </div>
    </>
  )
}
