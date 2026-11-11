import { Link, usePage } from '@inertiajs/react'
import { Badge, DemoCard, PageHeader } from '@/Components/Demo'

interface Value {
  generatedAt: string
  value: number
}

interface Props {
  page: number
  plans: Value
  freshData: Value
  expiringData: Value
  aliasedData: Value
  dynamicData: Value
}

const cards: { prop: keyof Omit<Props, 'page'>; title: string; description: string }[] = [
  { prop: 'plans', title: 'Inertia.once()', description: 'Resolved once, then reused: the client sends its key in X-Inertia-Except-Once-Props and the server skips it.' },
  { prop: 'freshData', title: '.fresh()', description: 'Always re-sent, even though the client remembers it.' },
  { prop: 'expiringData', title: '.until(5)', description: 'Remembered for 5 seconds, then fetched again.' },
  { prop: 'aliasedData', title: ".as('shared-once-key')", description: 'Remembered under a custom key, shareable across pages.' },
  { prop: 'dynamicData', title: 'Regular prop', description: 'Changes on every visit.' },
]

export default function OnceProps(props: Props) {
  const { onceProps } = usePage()

  return (
    <>
      <PageHeader
        title="Once props"
        description="Switch between the two pages below and watch which values change. The page object's onceProps metadata tells the client what to remember."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[1, 2].map((page) => (
          <Link key={page} href={page === 1 ? '/features/data/once-props' : '/features/data/once-props/2'} className={page === props.page ? 'btn-primary' : 'btn-secondary'}>
            Page {page}
          </Link>
        ))}
        <Badge>Remembered keys: {Object.keys(onceProps ?? {}).join(', ')}</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <DemoCard key={card.prop} title={card.title} description={card.description}>
            <div className="text-3xl font-semibold text-slate-900">{props[card.prop].value}</div>
            <div className="mt-1 text-xs text-slate-500">generated at {props[card.prop].generatedAt}</div>
          </DemoCard>
        ))}
      </div>
    </>
  )
}
