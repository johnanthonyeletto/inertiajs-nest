import { Head as InertiaHead } from '@inertiajs/react'
import { useState } from 'react'
import { DemoCard, PageHeader } from '@/Components/Demo'

export default function Head({ timestamp }: { timestamp: string }) {
  const [title, setTitle] = useState('Custom title')

  return (
    <>
      <PageHeader
        title="Title & meta"
        description="<Head> manages the document title and meta tags. With SSR enabled, the same tags are rendered on the server and sent in the HTML (view the page source of a full page load)."
        setsDocumentTitle={false}
      />
      <InertiaHead title={title}>
        <meta name="description" content={`Inertia × NestJS head demo, rendered at ${timestamp}`} />
      </InertiaHead>
      <DemoCard title="Change the title">
        <input className="input max-w-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="mt-2 text-sm text-slate-500">
          The title callback in <code className="inline">createInertiaApp</code> appends the app name.
        </p>
      </DemoCard>
    </>
  )
}
