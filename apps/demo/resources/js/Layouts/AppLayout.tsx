import { Link, usePage } from '@inertiajs/react'
import { type ReactNode, useEffect, useState } from 'react'
import FlashToaster from '@/Components/FlashToaster'
import { cn } from '@/lib/utils'
import { isActive, navigation } from './navigation'

/**
 * The default persistent layout (configured in `createInertiaApp`). It stays
 * mounted across visits, so the sidebar keeps its scroll position (it is a
 * `scroll-region`) and local state like the mobile menu survives navigation.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { url, props } = usePage()
  const user = props.auth.user
  const [menuOpen, setMenuOpen] = useState(false)
  const [serverRendered, setServerRendered] = useState<boolean | null>(null)

  useEffect(() => setMenuOpen(false), [url])

  useEffect(() => {
    setServerRendered(document.querySelector('[data-server-rendered="true"]') !== null)
  }, [])

  return (
    <div className="flex min-h-full">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 transition-transform lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        scroll-region=""
      >
        <Link href="/" className="flex items-center gap-2 px-2 text-sm font-semibold text-slate-900">
          <img src="/favicon.svg" alt="" className="size-7" />
          {props.appName}
        </Link>

        <nav className="mt-6 space-y-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <div className="px-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">{section.title}</div>
              <ul className="mt-2 space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch="hover"
                      className={cn(
                        'block rounded-md px-2 py-1.5 text-sm',
                        isActive(url, item.href)
                          ? 'bg-indigo-50 font-medium text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-8">
          <button type="button" className="btn-secondary lg:hidden" onClick={() => setMenuOpen((open) => !open)}>
            Menu
          </button>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            {serverRendered !== null && (
              <span title="Whether the first page load was server-side rendered">
                First load: {serverRendered ? 'server-side rendered' : 'client-side rendered'}
              </span>
            )}
          </div>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{user.name}</span>
              <Link href="/logout" method="post" as="button" className="btn-secondary">
                Sign out
              </Link>
            </div>
          ) : (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>

      {menuOpen && <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <FlashToaster />
    </div>
  )
}
