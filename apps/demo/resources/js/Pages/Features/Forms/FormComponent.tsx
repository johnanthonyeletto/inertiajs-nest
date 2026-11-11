import { Form, useFormContext, usePage } from '@inertiajs/react'
import { Badge, DemoCard, Json, PageHeader } from '@/Components/Demo'
import { FieldError } from '@/Components/Fields'
import { cn } from '@/lib/utils'

interface ProfileForm {
  name: string
  email: string
  plan: string
  company: { name: string; website: string }
  terms: boolean
}

/** Any descendant can read the surrounding <Form>'s state with useFormContext(). */
function SubmitButton() {
  const form = useFormContext<ProfileForm>()

  return (
    <button type="submit" className="btn-primary" disabled={form?.processing}>
      {form?.processing ? 'Submitting…' : 'Submit'}
    </button>
  )
}

export default function FormComponent() {
  const { flash } = usePage()

  return (
    <>
      <PageHeader
        title="<Form> component"
        description="The <Form> component serializes its inputs (bracket names like company[name] become nested data), submits with Inertia, and exposes state through a render prop — no useState required."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <Form<ProfileForm>
            action="/features/forms/form-component"
            method="post"
            options={{ preserveScroll: true }}
            transform={(data) => ({ ...data, terms: Boolean(data.terms) })}
            resetOnSuccess
            className="space-y-5"
          >
            {({ errors, isDirty, hasErrors, wasSuccessful, reset, clearErrors }) => (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="fc-name">Name</label>
                    <input id="fc-name" name="name" className={cn('input', errors.name && 'input-error')} />
                    <FieldError message={errors.name} />
                  </div>
                  <div>
                    <label className="label" htmlFor="fc-email">Email</label>
                    <input id="fc-email" name="email" className={cn('input', errors.email && 'input-error')} />
                    <FieldError message={errors.email} />
                  </div>
                  <div>
                    <label className="label" htmlFor="fc-plan">Plan</label>
                    <select id="fc-plan" name="plan" className={cn('input', errors.plan && 'input-error')} defaultValue="">
                      <option value="">Choose…</option>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <FieldError message={errors.plan} />
                  </div>
                  <div>
                    <label className="label" htmlFor="fc-company">Company name</label>
                    <input id="fc-company" name="company[name]" className={cn('input', errors['company.name'] && 'input-error')} />
                    <FieldError message={errors['company.name']} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="fc-website">Company website</label>
                    <input id="fc-website" name="company[website]" placeholder="https://" className={cn('input', errors['company.website'] && 'input-error')} />
                    <FieldError message={errors['company.website']} />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="terms" value="1" /> I accept the terms
                  </label>
                  <FieldError message={errors.terms} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton />
                  <button type="button" className="btn-secondary" onClick={() => reset()}>
                    Reset
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => clearErrors()}>
                    Clear errors
                  </button>
                  <Badge tone={isDirty ? 'amber' : 'slate'}>isDirty: {String(isDirty)}</Badge>
                  <Badge tone={hasErrors ? 'rose' : 'slate'}>hasErrors: {String(hasErrors)}</Badge>
                  {wasSuccessful && <Badge tone="emerald">wasSuccessful</Badge>}
                </div>
              </>
            )}
          </Form>
        </div>
        <DemoCard title="Last submission" description="Echoed back by the server as flash data.">
          {flash.submitted ? <Json value={flash.submitted} /> : <p className="text-sm text-slate-500">Nothing submitted yet.</p>}
        </DemoCard>
      </div>
    </>
  )
}
