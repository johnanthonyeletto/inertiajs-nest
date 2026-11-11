import { type CancelToken } from '@inertiajs/core'
import { router } from '@inertiajs/react'
import { useRef, useState } from 'react'
import { Badge, Code, DemoCard, PageHeader } from '@/Components/Demo'

export default function ManualVisits({ timestamp, counter }: { timestamp: string; counter: number }) {
  const [log, setLog] = useState<string[]>([])
  const cancelToken = useRef<CancelToken | null>(null)
  const append = (entry: string) => setLog((current) => [`${new Date().toLocaleTimeString()} ${entry}`, ...current].slice(0, 12))

  function visitWithCallbacks() {
    router.get('/features/manual-visits', { delay: 1 }, {
      preserveState: true,
      onBefore: () => append('onBefore'),
      onStart: () => append('onStart'),
      onProgress: () => append('onProgress'),
      onSuccess: () => append('onSuccess'),
      onError: () => append('onError'),
      onCancel: () => append('onCancel'),
      onFinish: () => append('onFinish'),
    })
  }

  function cancellableVisit() {
    router.get('/features/manual-visits', { delay: 4 }, {
      preserveState: true,
      onCancelToken: (token) => (cancelToken.current = token),
      onCancel: () => append('Visit cancelled'),
      onFinish: () => (cancelToken.current = null),
    })
    append('Started a 4 second visit…')
  }

  return (
    <>
      <PageHeader title="Manual visits" description="Everything a <Link> can do is available programmatically through the router." />

      <div className="mb-6 flex flex-wrap gap-3">
        <Badge tone="indigo">Timestamp: {timestamp}</Badge>
        <Badge tone="emerald">Counter: {counter}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="router.reload()" description="Reload the current page, optionally only some props (a partial reload).">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.reload()}>
              reload()
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.reload({ only: ['counter'] })}>
              reload({'{'} only: ['counter'] {'}'})
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.reload({ only: ['timestamp'], async: true, showProgress: false })}>
              async, no progress bar
            </button>
          </div>
        </DemoCard>

        <DemoCard title="Visit callbacks" description="Every lifecycle hook, in order, for a one second visit.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={visitWithCallbacks}>
              Visit with callbacks
            </button>
            <button type="button" className="btn-secondary" onClick={cancellableVisit}>
              Start slow visit
            </button>
            <button type="button" className="btn-secondary" onClick={() => cancelToken.current?.cancel()}>
              Cancel it
            </button>
          </div>
          <ol className="mt-4 space-y-1 font-mono text-xs text-slate-600">
            {log.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ol>
        </DemoCard>

        <DemoCard title="Client-side visits" description="Update the page without a server request.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.replaceProp('counter', (value: unknown) => Number(value) + 1)}>
              replaceProp('counter', n + 1)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push({ url: '/features/manual-visits?client=1', props: (props) => ({ ...props, timestamp: 'set on the client' }) })}
            >
              router.push()
            </button>
          </div>
          <Code>{`router.replaceProp('counter', (value) => value + 1)`}</Code>
        </DemoCard>

        <DemoCard title="Other methods">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.visit('/features/links')}>
              router.visit('/features/links')
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.post('/features/links', { from: 'manual' })}>
              router.post()
            </button>
          </div>
        </DemoCard>
      </div>
    </>
  )
}
