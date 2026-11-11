import { router } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

const actions = [
  { label: 'Redirect back', method: 'post', url: '/features/redirects/back', note: '302 to the Referer' },
  { label: 'Redirect to another page', method: 'post', url: '/features/redirects/to-route', note: '302 to /features/links' },
  { label: 'PUT → 303 See Other', method: 'put', url: '/features/redirects/see-other', note: '302 becomes 303 after PUT/PATCH/DELETE' },
  { label: 'External redirect', method: 'post', url: '/features/redirects/external', note: '409 + X-Inertia-Location → full page visit' },
] as const

export default function Redirects({ timestamp }: { timestamp: string }) {
  return (
    <>
      <PageHeader
        title="Redirects"
        description="Inertia follows standard redirects. The adapter converts 302s after PUT/PATCH/DELETE into 303s, and external URLs into a 409 with X-Inertia-Location."
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>
      <DemoCard title="Try it" className="mt-6">
        <ul className="divide-y divide-slate-100">
          {actions.map((action) => (
            <li key={action.url} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{action.label}</div>
                <div className="text-xs text-slate-500">{action.note}</div>
              </div>
              <button type="button" className="btn-secondary" onClick={() => router.visit(action.url, { method: action.method })}>
                {action.method.toUpperCase()}
              </button>
            </li>
          ))}
        </ul>
      </DemoCard>
    </>
  )
}
