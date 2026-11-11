import { Deferred, router } from '@inertiajs/react'
import { useState } from 'react'
import { DemoCard, Json, PageHeader, Skeleton, Spinner } from '@/Components/Demo'

interface Props {
  regularData: { timestamp: string }
  optionalData?: { generatedAt: string; contacts: { id: number; name: string }[] }
  deferredData?: { generatedAt: string; total: number }
}

export default function OptionalProps({ regularData, optionalData, deferredData }: Props) {
  const [loading, setLoading] = useState(false)

  return (
    <>
      <PageHeader
        title="Optional props"
        description="Optional props are never part of a full visit and are not announced; they are only evaluated when a partial reload explicitly asks for them. Compare with deferred props, which load automatically."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <DemoCard title="Regular">
          <Json value={regularData} />
        </DemoCard>
        <DemoCard title="Optional (on demand)">
          {optionalData ? (
            <Json value={optionalData} />
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={() => router.reload({ only: ['optionalData'], onStart: () => setLoading(true), onFinish: () => setLoading(false) })}
            >
              {loading && <Spinner />} Load optionalData
            </button>
          )}
        </DemoCard>
        <DemoCard title="Deferred (automatic)">
          <Deferred data="deferredData" fallback={<Skeleton />}>
            <Json value={deferredData} />
          </Deferred>
        </DemoCard>
      </div>
    </>
  )
}
