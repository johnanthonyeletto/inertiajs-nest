import { Link, setLayoutProps } from '@inertiajs/react'
import { type ReactNode, useEffect, useState } from 'react'
import { DemoCard, PageHeader } from '@/Components/Demo'
import AppLayout from '@/Layouts/AppLayout'

/** A nested layout with its own state. Because it persists, the timer keeps running across pages. */
function DemoLayout({ children, subtitle = 'No subtitle set' }: { children?: ReactNode; subtitle?: string }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-200 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        <span>
          Nested layout · mounted for <strong>{seconds}s</strong> · subtitle: <em>{subtitle}</em>
        </span>
        <span className="flex gap-2">
          <Link href="/features/layouts/persistent" className="link">
            Page 1
          </Link>
          <Link href="/features/layouts/persistent/2" className="link">
            Page 2
          </Link>
        </span>
      </div>
      {children}
    </div>
  )
}

export default function Persistent({ page }: { page: number }) {
  // Dynamic layout props target the named "demo" layout; they reset on navigation.
  useEffect(() => {
    setLayoutProps<{ subtitle: string }>('demo', { subtitle: `Set by page ${page}` })
  }, [page])

  return (
    <>
      <PageHeader
        title={`Persistent layouts — page ${page}`}
        description="This page replaces the default layout with named, nested layouts. Navigate between the pages: the layouts stay mounted, so the timer is never reset."
      />
      <DemoCard title="Definition">
        <pre className="text-xs text-slate-600">{`Persistent.layout = { app: AppLayout, demo: DemoLayout }\nsetLayoutProps('demo', { subtitle: 'Set by page ${page}' })`}</pre>
      </DemoCard>
    </>
  )
}

Persistent.layout = { app: AppLayout, demo: DemoLayout }
