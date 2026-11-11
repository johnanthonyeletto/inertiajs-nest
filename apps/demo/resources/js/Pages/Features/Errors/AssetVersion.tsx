import { router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { Badge, Code, DemoCard, PageHeader } from '@/Components/Demo'

export default function AssetVersion({ salt }: { salt: string | null }) {
  const { version } = usePage()
  const [interceptReload, setInterceptReload] = useState(false)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!interceptReload) return

    // The `location` event fires before Inertia performs a full page visit
    // (a 409 + X-Inertia-Location). Cancelling it lets you ask the user first.
    return router.on('location', (event) => {
      if (!event.detail.versionChange) return
      setPendingUrl(event.detail.url.href)
      return false
    })
  }, [interceptReload])

  return (
    <>
      <PageHeader
        title="Asset versioning"
        description="Every Inertia request sends X-Inertia-Version. When it no longer matches the server's version (a new deploy), the adapter answers GET requests with 409 Conflict + X-Inertia-Location, and the client performs a full page load to pick up the new assets."
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="indigo">Client version: {version || '(empty in dev)'}</Badge>
        <Badge>Simulated deploy salt: {salt ?? 'none'}</Badge>
      </div>
      <DemoCard title="Simulate a deployment" className="mt-6" description="Adds a per-session salt to the version. The POST redirects back, and that GET is answered with a 409.">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => router.post('/features/errors/asset-version/deploy')}>
            Deploy a new version
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={interceptReload} onChange={(e) => setInterceptReload(e.target.checked)} />
            Ask before reloading (cancel the <code className="inline">location</code> event)
          </label>
        </div>
        {pendingUrl && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            A new version is available.
            <button type="button" className="font-medium underline" onClick={() => window.location.assign(pendingUrl)}>
              Reload now
            </button>
          </div>
        )}
        <Code>{`InertiaModule.forRoot({\n  version: (request, assetVersion) => [assetVersion, request.session.assetVersionSalt].filter(Boolean).join('-'),\n})`}</Code>
      </DemoCard>
    </>
  )
}
