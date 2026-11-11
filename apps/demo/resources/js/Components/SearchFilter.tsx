import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'

interface Filters {
  search: string
  trashed: string
}

/**
 * Filters a listing with debounced GET visits. `preserveState` keeps the
 * input focused, `replace` avoids a history entry per keystroke, and `only`
 * turns each visit into a partial reload of just the listing.
 */
export default function SearchFilter({ url, filters, only }: { url: string; filters: Filters; only: string[] }) {
  const [values, setValues] = useState(filters)

  useEffect(() => {
    if (values.search === filters.search && values.trashed === filters.trashed) {
      return
    }

    const timeout = setTimeout(() => {
      const query = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
      router.get(url, query, { preserveState: true, preserveScroll: true, replace: true, only: [...only, 'filters'] })
    }, 300)

    return () => clearTimeout(timeout)
  }, [values])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Search…"
        className="input max-w-xs"
        value={values.search}
        onChange={(event) => setValues({ ...values, search: event.target.value })}
      />
      <select
        className="input w-auto"
        value={values.trashed}
        onChange={(event) => setValues({ ...values, trashed: event.target.value })}
      >
        <option value="">Active</option>
        <option value="with">With trashed</option>
        <option value="only">Only trashed</option>
      </select>
      {(values.search || values.trashed) && (
        <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setValues({ search: '', trashed: '' })}>
          Reset
        </button>
      )}
    </div>
  )
}
