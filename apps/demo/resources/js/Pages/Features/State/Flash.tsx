import { router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { Code, DemoCard, Json, PageHeader } from '@/Components/Demo'
import { cn } from '@/lib/utils'

export default function Flash({ timestamp }: { timestamp: string }) {
  const { flash } = usePage()
  const [events, setEvents] = useState<string[]>([])

  // The global `flash` event fires for every response carrying flash data.
  useEffect(
    () =>
      router.on('flash', (event) => {
        setEvents((current) => [`${new Date().toLocaleTimeString()} ${JSON.stringify(event.detail.flash)}`, ...current].slice(0, 5))
      }),
    [],
  )

  function send(type: 'success' | 'error' | 'warning') {
    router.post('/features/state/flash', { type }, { preserveScroll: true, onFlash: (data) => console.info('onFlash', data) })
  }

  return (
    <>
      <PageHeader
        title="Flash data"
        description="inertia.flash() data is delivered in the page object's flash field (not in props), is never written to history state, and is cleared after it is sent. Press back after a flash: it won't reappear."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Flash from the server" description={`Rendered at ${timestamp}`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => send('success')}>
              Success
            </button>
            <button type="button" className="btn-secondary" onClick={() => send('warning')}>
              Warning
            </button>
            <button type="button" className="btn-secondary" onClick={() => send('error')}>
              Error
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.flash('toast', { type: 'success', message: 'Flashed on the client with router.flash()' })}
            >
              Client-side flash
            </button>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((cell) => (
              <div key={cell} className={cn('h-10 rounded-md transition', flash.highlight === cell ? 'bg-amber-300' : 'bg-slate-100')} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">The server also flashes a random cell to highlight.</p>
        </DemoCard>
        <DemoCard title="page.flash">
          <Json value={flash} />
          <h3 className="mt-4 text-xs font-semibold text-slate-500 uppercase">router.on('flash') log</h3>
          <ul className="mt-2 space-y-1 font-mono text-xs text-slate-600">
            {events.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ul>
        </DemoCard>
      </div>
      <Code>{`return inertia.flash('toast', { type: 'success', message: 'Saved!' }).back()`}</Code>
    </>
  )
}
