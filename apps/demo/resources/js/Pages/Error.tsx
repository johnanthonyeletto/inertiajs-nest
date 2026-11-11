import { Head, Link } from '@inertiajs/react'

const titles: Record<number, string> = {
  403: 'Forbidden',
  404: 'Page not found',
  500: 'Server error',
  503: 'Service unavailable',
}

const descriptions: Record<number, string> = {
  403: 'Sorry, you are not allowed to access this page.',
  404: 'Sorry, the page you are looking for could not be found.',
  500: 'Whoops, something went wrong on our servers.',
  503: 'Sorry, we are doing some maintenance. Please check back soon.',
}

/** Rendered by the server's `renderError` hook for 403, 404, 500, and 503 responses. */
export default function Error({ status, message }: { status: number; message: string | null }) {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <Head title={titles[status] ?? 'Error'} />
      <div className="text-5xl font-bold text-indigo-600">{status}</div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{titles[status] ?? 'Error'}</h1>
      <p className="mt-2 text-sm text-slate-600">{descriptions[status] ?? 'An error occurred.'}</p>
      {message && <p className="mt-2 font-mono text-xs text-slate-400">{message}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => window.history.back()}>
          Go back
        </button>
        <Link href="/" className="btn-primary">
          Dashboard
        </Link>
      </div>
    </div>
  )
}
