import { router } from '@inertiajs/react'
import { Badge, DemoCard, Json, PageHeader } from '@/Components/Demo'

interface Props {
  timestamp: string
  notifications: { id: string; message: string; level: string }[]
  activity: { id: string; action: string; at: string }[]
  team: { id: number; name: string; seenAt: string }[]
  conversation: { meta: { title: string; loadedPages: number; lastLoadedAt: string }; messages: { id: number; body: string }[] }
}

export default function MergeProps({ timestamp, notifications, activity, team, conversation }: Props) {
  const reload = (only: string[], reset: string[] = []) => router.reload({ only, reset })

  return (
    <>
      <PageHeader
        title="Merging props"
        description="On partial reloads, merge props are combined with the client's current value instead of replacing it. The page object labels them with mergeProps, prependProps, deepMergeProps, and matchPropsOn."
        actions={
          <button type="button" className="btn-secondary" onClick={() => router.visit('/features/data/merge-props')}>
            Full visit (replaces everything)
          </button>
        }
      />
      <Badge tone="indigo">Rendered at {timestamp}</Badge>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DemoCard title="Append — Inertia.merge()">
          <button type="button" className="btn-secondary" onClick={() => reload(['notifications'])}>
            Load more notifications
          </button>
          <ul className="mt-3 space-y-1 text-sm">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Badge tone={notification.level === 'warning' ? 'amber' : notification.level === 'success' ? 'emerald' : 'indigo'}>
                  {notification.level}
                </Badge>{' '}
                {notification.message}
              </li>
            ))}
          </ul>
        </DemoCard>

        <DemoCard title="Prepend — .prepend()">
          <button type="button" className="btn-secondary" onClick={() => reload(['activity'])}>
            New activity
          </button>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {activity.map((item) => (
              <li key={item.id}>
                <span className="text-slate-400">{item.at}</span> {item.action}
              </li>
            ))}
          </ul>
        </DemoCard>

        <DemoCard title="Match on id — .matchOn('id')" description="Existing members are updated in place (seenAt changes) and new ones are appended.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => reload(['team'])}>
              Reload team
            </button>
            <button type="button" className="btn-secondary" onClick={() => reload(['team'], ['team'])}>
              Reset team
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {team.map((member) => (
              <li key={member.id}>
                #{member.id} {member.name} <span className="text-slate-400">seen {member.seenAt}</span>
              </li>
            ))}
          </ul>
        </DemoCard>

        <DemoCard title="Deep merge — Inertia.deepMerge()" description="Nested objects merge; messages append, matched on messages.id.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => reload(['conversation'])}>
              Load older messages
            </button>
            <button type="button" className="btn-secondary" onClick={() => reload(['conversation'], ['conversation'])}>
              Reset conversation
            </button>
          </div>
          <div className="mt-3">
            <Json value={conversation} />
          </div>
        </DemoCard>
      </div>
    </>
  )
}
