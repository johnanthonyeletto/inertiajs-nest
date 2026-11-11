import { WhenVisible as WhenVisibleComponent } from '@inertiajs/react'
import Avatar from '@/Components/Avatar'
import { DemoCard, Json, PageHeader, Skeleton } from '@/Components/Demo'
import type { Contact } from '@/types/global'

interface Props {
  teamMembers?: { id: number; name: string }[]
  statistics?: { contacts: number; generatedAt: string }
  favorites?: Contact[]
}

export default function WhenVisible({ teamMembers, statistics, favorites }: Props) {
  return (
    <>
      <PageHeader
        title="Load when visible"
        description="<WhenVisible> requests optional props with a partial reload once its placeholder scrolls into view (an IntersectionObserver). Scroll down."
      />
      <div className="flex h-[80vh] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400">
        Scroll down ↓
      </div>

      <DemoCard title="Team members" description="Loads when visible." className="mt-6">
        <WhenVisibleComponent data="teamMembers" fallback={<Skeleton lines={5} />}>
          <ul className="space-y-1 text-sm text-slate-700">{teamMembers?.map((member) => <li key={member.id}>{member.name}</li>)}</ul>
        </WhenVisibleComponent>
      </DemoCard>

      <div className="h-[60vh]" />

      <DemoCard title="Statistics" description="buffer={200}: starts loading 200px before it is visible. always: reloads every time it re-enters the viewport." className="mt-6">
        <WhenVisibleComponent data="statistics" buffer={200} always fallback={<Skeleton lines={2} />}>
          {({ fetching }) => (
            <div className={fetching ? 'opacity-50' : ''}>
              <Json value={statistics} />
            </div>
          )}
        </WhenVisibleComponent>
      </DemoCard>

      <div className="h-[60vh]" />

      <DemoCard title="Favorites" className="mt-6">
        <WhenVisibleComponent data="favorites" fallback={<Skeleton lines={5} />}>
          <ul className="space-y-2">
            {favorites?.map((contact) => (
              <li key={contact.id} className="flex items-center gap-2 text-sm">
                <Avatar name={contact.name} url={contact.avatarUrl} className="size-7" />
                {contact.name}
              </li>
            ))}
          </ul>
        </WhenVisibleComponent>
      </DemoCard>
    </>
  )
}
