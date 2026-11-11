import { router, usePage } from '@inertiajs/react'
import { useState } from 'react'
import Avatar from '@/Components/Avatar'
import { PageHeader } from '@/Components/Demo'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/global'

interface Props {
  contacts: Contact[]
}

export default function OptimisticUpdates({ contacts }: Props) {
  const { props } = usePage()
  const [fail, setFail] = useState(false)
  const [pending, setPending] = useState<number[]>([])

  function toggle(contact: Contact) {
    setPending((ids) => [...ids, contact.id])

    router
      .optimistic<Props>((current) => ({
        contacts: current.contacts.map((item) => (item.id === contact.id ? { ...item, isFavorite: !item.isFavorite } : item)),
      }))
      .post(`/features/forms/optimistic-updates/${contact.id}/toggle${fail ? '?fail=1' : ''}`, {}, {
        preserveScroll: true,
        only: ['contacts'],
        onFinish: () => setPending((ids) => ids.filter((id) => id !== contact.id)),
      })
  }

  const error = (props.errors as Record<string, string>).favorite

  return (
    <>
      <PageHeader
        title="Optimistic updates"
        description="The star flips immediately while the (1 second) request is in flight. If the server responds with a validation error, the change is rolled back automatically."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make the server fail
          </label>
        }
      />
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <ul className="card divide-y divide-slate-100">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-center justify-between px-5 py-3">
            <span className="flex items-center gap-3 text-sm">
              <Avatar name={contact.name} url={contact.avatarUrl} className="size-8" />
              {contact.name}
            </span>
            <button
              type="button"
              onClick={() => toggle(contact)}
              className={cn('text-xl leading-none', contact.isFavorite ? 'text-amber-500' : 'text-slate-300', pending.includes(contact.id) && 'animate-pulse')}
              aria-label="Toggle favorite"
            >
              ★
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
