import { Link, router, usePage } from '@inertiajs/react'
import Avatar from '@/Components/Avatar'
import { PageHeader } from '@/Components/Demo'
import Pagination from '@/Components/Pagination'
import SearchFilter from '@/Components/SearchFilter'
import { cn } from '@/lib/utils'
import type { Contact, Paginated } from '@/types/global'

interface Props {
  filters: { search: string; trashed: string }
  contacts: Paginated<Contact>
}

export default function Index({ filters, contacts }: Props) {
  const { flash } = usePage()

  function toggleFavorite(contact: Contact) {
    router
      .optimistic<Props>((props) => ({
        contacts: {
          ...props.contacts,
          data: props.contacts.data.map((item) => (item.id === contact.id ? { ...item, isFavorite: !item.isFavorite } : item)),
        },
      }))
      .post(`/contacts/${contact.id}/favorite`, {}, { preserveScroll: true, only: ['contacts'] })
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Search is debounced and runs as a partial reload. Stars toggle with an optimistic update. A newly created contact is highlighted via flash data."
        actions={
          <Link href="/contacts/create" className="btn-primary">
            New contact
          </Link>
        }
      />
      <SearchFilter url="/contacts" filters={filters} only={['contacts']} />

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.data.map((contact) => (
              <tr key={contact.id} className={cn('hover:bg-slate-50', flash.createdContactId === contact.id && 'bg-emerald-50')}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(contact)}
                    className={cn('text-lg leading-none', contact.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400')}
                    aria-label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    ★
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/contacts/${contact.id}/edit`} prefetch className="flex items-center gap-3 font-medium text-slate-900 hover:text-indigo-600">
                    <Avatar name={contact.name} url={contact.avatarUrl} className="size-8" />
                    {contact.name}
                  </Link>
                  {contact.deletedAt && <span className="ml-11 text-xs text-rose-500">(deleted)</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{contact.organization?.name}</td>
                <td className="px-4 py-3 text-slate-600">{contact.city}</td>
                <td className="px-4 py-3 text-slate-600">{contact.phone}</td>
              </tr>
            ))}
            {contacts.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
        <span>
          {contacts.meta.from ?? 0}–{contacts.meta.to ?? 0} of {contacts.meta.total}
        </span>
        <Pagination links={contacts.links} />
      </div>
    </>
  )
}
