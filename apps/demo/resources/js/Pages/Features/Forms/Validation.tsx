import { useForm, usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { Code, DemoCard, Json, PageHeader } from '@/Components/Demo'
import { TextInput } from '@/Components/Fields'

export default function Validation() {
  const { props } = usePage()
  const primary = useForm({ name: '', email: '' })
  const secondary = useForm({ company: '', website: '' })

  function submitPrimary(event: FormEvent) {
    event.preventDefault()
    primary.post('/features/forms/validation', { preserveScroll: true })
  }

  function submitSecondary(event: FormEvent) {
    event.preventDefault()
    // The X-Inertia-Error-Bag header makes the server nest errors under "secondary".
    secondary.post('/features/forms/validation/secondary', { preserveScroll: true, errorBag: 'secondary' })
  }

  return (
    <>
      <PageHeader
        title="Validation & error bags"
        description="Validation errors are flashed to the session and shared as the always-present errors prop. With an error bag, the adapter nests them under the bag's name so two forms on one page don't share errors."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Primary form" description="Default error bag.">
          <form onSubmit={submitPrimary} className="space-y-4">
            <TextInput label="Name" name="name" value={primary.data.name} onChange={(e) => primary.setData('name', e.target.value)} error={primary.errors.name} />
            <TextInput label="Email" name="email" value={primary.data.email} onChange={(e) => primary.setData('email', e.target.value)} error={primary.errors.email} />
            <button type="submit" className="btn-primary" disabled={primary.processing}>
              Submit primary
            </button>
          </form>
        </DemoCard>
        <DemoCard title="Secondary form" description="errorBag: 'secondary'">
          <form onSubmit={submitSecondary} className="space-y-4">
            <TextInput label="Company" name="company" value={secondary.data.company} onChange={(e) => secondary.setData('company', e.target.value)} error={secondary.errors.company} />
            <TextInput label="Website" name="website" value={secondary.data.website} onChange={(e) => secondary.setData('website', e.target.value)} error={secondary.errors.website} />
            <button type="submit" className="btn-primary" disabled={secondary.processing}>
              Submit secondary
            </button>
          </form>
        </DemoCard>
      </div>
      <DemoCard title="The errors prop" description="Exactly what the server sent in page.props.errors." className="mt-6">
        <Json value={props.errors} />
        <Code>{`secondary.post('/features/forms/validation/secondary', { errorBag: 'secondary' })`}</Code>
      </DemoCard>
    </>
  )
}
