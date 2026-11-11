import { Link, usePage } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader, Skeleton } from '@/Components/Demo'

interface Props {
  greeting?: string
  timestamp?: string
  items?: { id: number; name: string }[]
}

/** Renders immediately during an instant visit, before its page props exist. */
export default function InstantVisitTarget({ greeting, timestamp, items }: Props) {
  const { props } = usePage()

  return (
    <>
      <PageHeader title="Instant visit target" description="Shared props (like the signed-in user) are available immediately; page props arrive with the response." />
      <div className="flex flex-wrap gap-2">
        <Badge tone="emerald">Signed in as {props.auth.user?.name}</Badge>
        <Badge tone="indigo">{greeting ?? 'Waiting for the server…'}</Badge>
        {timestamp && <Badge>{timestamp}</Badge>}
      </div>
      <DemoCard title="Items from the server" className="mt-6">
        {items ? (
          <ul className="list-inside list-disc text-sm text-slate-700">
            {items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        ) : (
          <Skeleton />
        )}
      </DemoCard>
      <Link href="/features/instant-visits" className="link mt-6 inline-block text-sm">
        ← Back
      </Link>
    </>
  )
}
