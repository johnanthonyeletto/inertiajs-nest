import { Link } from '@inertiajs/react'
import { PageHeader } from '@/Components/Demo'

const colors = ['bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-sky-400', 'bg-indigo-400', 'bg-fuchsia-400']

export default function ViewTransitions({ photo }: { photo: number | null }) {
  return (
    <>
      <PageHeader
        title="View transitions"
        description="Visits with viewTransition wrap the page swap in document.startViewTransition(), so shared elements (matching view-transition-name) animate between pages."
      />
      {photo ? (
        <div>
          <div className={`aspect-video w-full rounded-2xl ${colors[photo - 1]}`} style={{ viewTransitionName: `photo-${photo}` }} />
          <Link href="/features/view-transitions" viewTransition className="btn-secondary mt-6">
            ← All photos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {colors.map((color, index) => (
            <Link
              key={color}
              href={`/features/view-transitions?photo=${index + 1}`}
              viewTransition
              className={`aspect-square rounded-2xl ${color} transition hover:opacity-90`}
              style={{ viewTransitionName: `photo-${index + 1}` }}
            />
          ))}
        </div>
      )}
    </>
  )
}
