import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { Badge, DemoCard, Json, PageHeader } from '@/Components/Demo'
import { FieldError, SelectInput, TextInput } from '@/Components/Fields'

interface ProfileForm {
  name: string
  email: string
  plan: string
  company: { name: string; website: string }
  terms: boolean
}

export default function UseForm() {
  // The remember key keeps the form's data in history state across visits.
  const form = useForm<ProfileForm>('features:profile', {
    name: '',
    email: '',
    plan: '',
    company: { name: '', website: '' },
    terms: false,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ ...data, name: data.name.trim() }))
    form.post('/features/forms/use-form', {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  return (
    <>
      <PageHeader
        title="useForm"
        description="The form helper tracks data, errors (including nested company.name keys), dirtiness, and submission state. Validation runs on the server with class-validator; failures redirect back with errors."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="card space-y-5 p-6 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput label="Name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} />
            <TextInput label="Email" name="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} error={form.errors.email} />
            <SelectInput label="Plan" name="plan" value={form.data.plan} onChange={(e) => form.setData('plan', e.target.value)} error={form.errors.plan}>
              <option value="">Choose…</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </SelectInput>
            <TextInput
              label="Company name"
              name="company.name"
              value={form.data.company.name}
              onChange={(e) => form.setData('company.name', e.target.value)}
              error={form.errors['company.name']}
            />
            <TextInput
              label="Company website"
              name="company.website"
              placeholder="https://"
              value={form.data.company.website}
              onChange={(e) => form.setData('company.website', e.target.value)}
              error={form.errors['company.website']}
              className="sm:col-span-2"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.data.terms} onChange={(e) => form.setData('terms', e.target.checked)} />
              I accept the terms
            </label>
            <FieldError message={form.errors.terms} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={form.processing}>
              {form.processing ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => form.reset()}>
              Reset
            </button>
            <button type="button" className="btn-secondary" onClick={() => form.clearErrors()} disabled={!form.hasErrors}>
              Clear errors
            </button>
            <button type="button" className="btn-secondary" onClick={() => form.setError('name', 'A client-side error.')}>
              setError('name')
            </button>
            <button type="button" className="btn-secondary" onClick={() => form.setDefaults()}>
              Use current data as defaults
            </button>
            {form.recentlySuccessful && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </form>

        <DemoCard title="Form state">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone={form.isDirty ? 'amber' : 'slate'}>isDirty: {String(form.isDirty)}</Badge>
            <Badge tone={form.processing ? 'indigo' : 'slate'}>processing: {String(form.processing)}</Badge>
            <Badge tone={form.hasErrors ? 'rose' : 'slate'}>hasErrors: {String(form.hasErrors)}</Badge>
            <Badge tone={form.wasSuccessful ? 'emerald' : 'slate'}>wasSuccessful: {String(form.wasSuccessful)}</Badge>
          </div>
          <Json value={{ data: form.data, errors: form.errors }} />
        </DemoCard>
      </div>
    </>
  )
}
