import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  setsDocumentTitle = true,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  setsDocumentTitle?: boolean
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      {setsDocumentTitle && <Head title={title} />}
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DemoCard({
  title,
  description,
  children,
  className,
  id,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('card p-6', className)}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-5 text-slate-100">
      <code>{children.trim()}</code>
    </pre>
  )
}

export function Json({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700 ring-1 ring-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      role="status"
      aria-label="Loading"
    />
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="h-4 rounded bg-slate-200" style={{ width: `${90 - index * 15}%` }} />
      ))}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}
