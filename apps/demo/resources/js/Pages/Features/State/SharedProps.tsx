import { usePage } from '@inertiajs/react'
import { Code, DemoCard, Json, PageHeader } from '@/Components/Demo'

export default function SharedProps() {
  const page = usePage<{ controllerShared: { message: string; at: string }; favoritesCount: number }>()

  return (
    <>
      <PageHeader
        title="Shared props"
        description="Props shared globally (the share option of InertiaModule.forRoot) or per request (inertia.share() in a controller) are merged into every page. Their top-level keys are listed in the page object's sharedProps."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Global (module options)">
          <Json value={{ appName: page.props.appName, auth: page.props.auth }} />
          <Code>{`InertiaModule.forRoot({\n  share: (request) => ({ appName, auth: { user: request.user?.toPublic() ?? null } }),\n})`}</Code>
        </DemoCard>
        <DemoCard title="Per request (controller)">
          <Json value={{ controllerShared: page.props.controllerShared, favoritesCount: page.props.favoritesCount }} />
          <Code>{`inertia.share('controllerShared', { ... })\ninertia.shareOnce('favoritesCount', () => Contact.count(...))`}</Code>
        </DemoCard>
        <DemoCard title="page.sharedProps" className="lg:col-span-2">
          <Json value={page.sharedProps} />
        </DemoCard>
      </div>
    </>
  )
}
