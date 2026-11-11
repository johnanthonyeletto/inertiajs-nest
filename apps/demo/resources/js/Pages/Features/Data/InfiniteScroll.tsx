import { InfiniteScroll as InfiniteScrollComponent, router } from '@inertiajs/react'
import Avatar from '@/Components/Avatar'
import { PageHeader, Spinner } from '@/Components/Demo'
import { cn } from '@/lib/utils'
import type { Contact, Paginated } from '@/types/global'

interface Props {
  favorites: boolean
  contacts: Paginated<Contact>
}

export default function InfiniteScroll({ favorites, contacts }: Props) {
  function filter(favoritesOnly: boolean) {
    // Reset the scroll prop so the new results replace (rather than merge into) the list.
    router.visit('/features/data/infinite-scroll', {
      data: favoritesOnly ? { favorites: 1 } : {},
      only: ['contacts', 'favorites'],
      reset: ['contacts'],
      preserveState: true,
    })
  }

  return (
    <>
      <PageHeader
        title="Infinite scroll"
        description="Inertia.scroll() wraps a paginator: the server labels contacts.data for merging and emits a scrollProps cursor. <InfiniteScroll> loads the next (or previous) page as you scroll and keeps ?page= in the URL in sync."
        actions={
          <div className="flex gap-2">
            <button type="button" className={cn(!favorites ? 'btn-primary' : 'btn-secondary')} onClick={() => filter(false)}>
              All
            </button>
            <button type="button" className={cn(favorites ? 'btn-primary' : 'btn-secondary')} onClick={() => filter(true)}>
              Favorites
            </button>
          </div>
        }
      />
      <p className="mb-4 text-sm text-slate-500">
        {contacts.meta.total} contacts · loaded {contacts.data.length}
      </p>
      <InfiniteScrollComponent
        data="contacts"
        buffer={300}
        className="card divide-y divide-slate-100"
        loading={() => (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
      >
        {contacts.data.map((contact) => (
          <div key={contact.id} className="flex items-center gap-3 px-5 py-3 text-sm">
            <Avatar name={contact.name} url={contact.avatarUrl} className="size-8" />
            <span className="font-medium text-slate-900">{contact.name}</span>
            <span className="text-slate-500">{contact.email}</span>
            {contact.isFavorite && <span className="ml-auto text-amber-500">★</span>}
          </div>
        ))}
      </InfiniteScrollComponent>
    </>
  )
}
