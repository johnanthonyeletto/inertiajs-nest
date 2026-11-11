import { Link, router } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

interface Props {
  timestamp: string
  items: { id: number; title: string }[]
}

export default function ScrollManagement({ timestamp, items }: Props) {
  return (
    <>
      <PageHeader
        title="Scroll management"
        description="Visits scroll to the top unless preserveScroll is set. Elements marked with the scroll-region attribute (like the sidebar and the box below) have their scroll position remembered in history."
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DemoCard title="Scroll region" description="Scroll this box, visit another page, then press the browser's back button: the position is restored.">
          <div scroll-region="" className="h-72 overflow-y-auto rounded-lg ring-1 ring-slate-200">
            {items.map((item) => (
              <div key={item.id} className="border-b border-slate-100 px-4 py-3 text-sm">
                {item.title}
              </div>
            ))}
          </div>
          <Link href="/features/links" className="link mt-4 inline-block text-sm">
            Visit another page →
          </Link>
        </DemoCard>
        <DemoCard title="Document scroll" description="Scroll down the page and use the controls at the bottom.">
          <p className="text-sm text-slate-600">Controls are repeated at the bottom of the page.</p>
        </DemoCard>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card px-4 py-6 text-sm text-slate-600">
            {item.title}
          </div>
        ))}
      </div>

      <div className="card sticky bottom-4 mt-6 flex flex-wrap gap-2 p-4">
        <button type="button" className="btn-secondary" onClick={() => router.visit('/features/scroll-management', { preserveScroll: false })}>
          Visit (scrolls to top)
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.visit('/features/scroll-management', { preserveScroll: true })}>
          Visit with preserveScroll
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.visit('/features/scroll-management', { preserveScroll: 'errors' })}
        >
          preserveScroll: 'errors'
        </button>
      </div>
    </>
  )
}
