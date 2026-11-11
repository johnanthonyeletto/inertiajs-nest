import { Link } from '@inertiajs/react'
import type { PaginationLink } from '@/types/global'
import { cn } from '@/lib/utils'

export default function Pagination({ links }: { links: PaginationLink[] }) {
  if (links.length <= 3) return null

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Pagination">
      {links.map((link, index) =>
        link.url === null ? (
          <span key={index} className="rounded-md px-3 py-1.5 text-sm text-slate-400">
            {link.label}
          </span>
        ) : (
          <Link
            key={index}
            href={link.url}
            preserveScroll
            prefetch="hover"
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm',
              link.active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            {link.label}
          </Link>
        ),
      )}
    </nav>
  )
}
