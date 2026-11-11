import { Link, usePage } from '@inertiajs/react'
import { PageHeader } from '@/Components/Demo'
import { navigation } from '@/Layouts/navigation'

export default function Index() {
  const { version } = usePage()

  return (
    <>
      <PageHeader
        title="Feature tour"
        description={
          <>
            Every page in this section exercises part of the Inertia v3 protocol against the NestJS adapter in{' '}
            <code className="inline">src/inertia</code>. Current asset version: <code className="inline">{version || '(dev server)'}</code>
          </>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {navigation.slice(1).map((section) => (
          <div key={section.title} className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
            <ul className="mt-3 space-y-1.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch className="link text-sm">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
