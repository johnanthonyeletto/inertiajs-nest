import { Link, router } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

export default function History({ visit, timestamp, secret }: { visit: number; timestamp: string; secret: string }) {
  return (
    <>
      <PageHeader
        title="History encryption"
        description={
          <>
            This route uses the <code className="inline">@EncryptHistory()</code> decorator, so the page object includes{' '}
            <code className="inline">encryptHistory: true</code> and the client encrypts this page's state in history (with a key kept in
            sessionStorage). Clearing history rotates the key, so pages in history can no longer be decrypted and are reloaded from the
            server instead, e.g. after a logout.
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="indigo">Visit #{visit}</Badge>
        <Badge>{timestamp}</Badge>
        <Badge tone="rose">Sensitive value: {secret}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DemoCard title="Build up history">
          <Link href={`/features/history?visit=${visit + 1}`} className="btn-secondary">
            Next visit →
          </Link>
          <p className="mt-3 text-sm text-slate-600">Click a few times, then use the browser's back button.</p>
        </DemoCard>
        <DemoCard title="Clear it" description="Either on the client, or from the server with inertia.clearHistory() (which sets clearHistory: true on the next page).">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.clearHistory()}>
              router.clearHistory()
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.post('/features/history/clear')}>
              Clear on the server
            </button>
          </div>
        </DemoCard>
      </div>
    </>
  )
}
