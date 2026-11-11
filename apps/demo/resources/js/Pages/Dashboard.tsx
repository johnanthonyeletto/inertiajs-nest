import { Deferred, Link } from '@inertiajs/react'
import Avatar from '@/Components/Avatar'
import { DemoCard, PageHeader, Skeleton, Stat } from '@/Components/Demo'
import { formatDate } from '@/lib/utils'
import type { Contact, Note } from '@/types/global'

interface Props {
  stats: { organizations: number; contacts: number; favorites: number; notes: number }
  recentNotes?: Note[]
  favorites?: Contact[]
}

export default function Dashboard({ stats, recentNotes, favorites }: Props) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            A small CRM backed by NestJS + Sequelize (SQLite). Stats render with the page; recent notes and favorites are{' '}
            <strong>deferred props</strong> loaded in two parallel requests right after the page appears.
          </>
        }
        actions={
          <Link href="/contacts/create" className="btn-primary">
            New contact
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Organizations" value={stats.organizations} />
        <Stat label="Contacts" value={stats.contacts} />
        <Stat label="Favorites" value={stats.favorites} />
        <Stat label="Notes" value={stats.notes} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <DemoCard title="Recent notes" description="Deferred prop, group “default”." className="lg:col-span-2">
          <Deferred data="recentNotes" fallback={<Skeleton lines={5} />}>
            <ul className="divide-y divide-slate-100">
              {recentNotes?.map((note) => (
                <li key={note.id} className="py-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    {note.contact && (
                      <Link href={`/contacts/${note.contact.id}/edit`} className="link">
                        {note.contact.name}
                      </Link>
                    )}
                    <span>{formatDate(note.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{note.body}</p>
                </li>
              ))}
            </ul>
          </Deferred>
        </DemoCard>

        <DemoCard title="Favorites" description="Deferred prop, group “sidebar”.">
          <Deferred data="favorites" fallback={<Skeleton lines={6} />}>
            <ul className="space-y-3">
              {favorites?.map((contact) => (
                <li key={contact.id}>
                  <Link href={`/contacts/${contact.id}/edit`} className="flex items-center gap-3 text-sm hover:text-indigo-600">
                    <Avatar name={contact.name} url={contact.avatarUrl} className="size-8" />
                    {contact.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Deferred>
        </DemoCard>
      </div>
    </>
  )
}
