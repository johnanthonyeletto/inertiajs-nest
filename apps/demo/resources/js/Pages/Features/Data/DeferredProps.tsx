import { Deferred, router } from '@inertiajs/react'
import Avatar from '@/Components/Avatar'
import { Badge, Code, DemoCard, PageHeader, Skeleton, Stat } from '@/Components/Demo'
import type { Contact } from '@/types/global'

interface Props {
  quickStat: string
  slowStats?: { contacts: number; favorites: number }
  recentContacts?: Contact[]
  flakyReport?: { value: number }
}

export default function DeferredProps({ quickStat, slowStats, recentContacts, flakyReport }: Props) {
  return (
    <>
      <PageHeader
        title="Deferred props"
        description="Deferred props are announced in the page object's deferredProps (grouped) and fetched right after the page renders: one partial reload per group, in parallel."
      />
      <Badge tone="emerald">{quickStat}</Badge>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <DemoCard title="slowStats" description="Group “default”, ~0.8s.">
          <Deferred data="slowStats" fallback={<Skeleton />}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Contacts" value={slowStats?.contacts} />
              <Stat label="Favorites" value={slowStats?.favorites} />
            </div>
          </Deferred>
        </DemoCard>

        <DemoCard title="recentContacts" description="Group “heavy”, ~1.6s, loaded in parallel.">
          <Deferred data="recentContacts" fallback={<Skeleton lines={5} />}>
            <ul className="space-y-2">
              {recentContacts?.map((contact) => (
                <li key={contact.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={contact.name} url={contact.avatarUrl} className="size-7" />
                  {contact.name}
                </li>
              ))}
            </ul>
          </Deferred>
        </DemoCard>

        <DemoCard title="flakyReport" description="Deferred with rescue: the server catches the error and reports it in rescuedProps.">
          <Deferred
            data="flakyReport"
            fallback={<Skeleton lines={2} />}
            rescue={({ reloading }) => (
              <div className="space-y-3 text-sm text-rose-700">
                <p>The report failed to load.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={reloading}
                  onClick={() => router.reload({ only: ['flakyReport'], headers: { 'X-Force-Success': '1' } })}
                >
                  {reloading ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            )}
          >
            <Stat label="Report value" value={flakyReport?.value} />
          </Deferred>
        </DemoCard>
      </div>

      <Code>{`
// Server
slowStats: Inertia.defer(() => stats()),
recentContacts: Inertia.defer(() => contacts(), 'heavy'),
flakyReport: Inertia.defer(() => report(), null, { rescue: true }),

// Client
<Deferred data="slowStats" fallback={<Skeleton />}>...</Deferred>
`}</Code>
    </>
  )
}
