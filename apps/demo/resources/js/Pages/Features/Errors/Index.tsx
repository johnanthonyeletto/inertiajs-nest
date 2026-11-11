import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { Code, DemoCard, PageHeader } from '@/Components/Demo'

const statuses = [
  { status: 403, note: 'Rendered as the Error page component' },
  { status: 404, note: 'Rendered as the Error page component' },
  { status: 500, note: 'An unexpected exception → Error page' },
  { status: 418, note: 'A non-Inertia HTML response → error modal' },
]

export default function Index() {
  const [intercept, setIntercept] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!intercept) return

    // Returning false from an httpException listener prevents the default handling (the modal/page).
    return router.on('httpException', (event) => {
      setMessage(`Intercepted a ${event.detail.response.status} response.`)
      return false
    })
  }, [intercept])

  function networkError() {
    router.visit('http://127.0.0.1:1/unreachable', {
      onNetworkError: (error) => {
        setMessage(`Network error: ${error.message || 'the server could not be reached'}.`)
        return false
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Error handling"
        description="The adapter's exception filter calls the renderError hook from InertiaModule.forRoot(): known statuses render the Error component with the real HTTP status; anything else returns plain HTML, which the client shows in a modal."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="HTTP errors">
          <ul className="divide-y divide-slate-100">
            {statuses.map(({ status, note }) => (
              <li key={status} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-600">{note}</span>
                <button type="button" className="btn-secondary" onClick={() => router.visit(`/features/errors/throw/${status}`)}>
                  {status}
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={intercept} onChange={(e) => setIntercept(e.target.checked)} />
            Intercept with <code className="inline">router.on('httpException')</code>
          </label>
        </DemoCard>
        <DemoCard title="Network errors" description="When the server can't be reached at all, the networkError event fires instead.">
          <button type="button" className="btn-secondary" onClick={networkError}>
            Visit an unreachable server
          </button>
        </DemoCard>
      </div>
      {message && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
      <Code>{`
renderError: ({ status, inertia }) => {
  if ([403, 404, 500, 503].includes(status)) {
    return inertia.render('Error', { status }).status(status)
  }
}
`}</Code>
    </>
  )
}
