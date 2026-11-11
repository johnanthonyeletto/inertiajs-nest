import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { Badge, Code, PageHeader } from '@/Components/Demo'
import { FieldError } from '@/Components/Fields'
import { cn } from '@/lib/utils'

type Field = 'username' | 'email' | 'password' | 'passwordConfirmation'

const fields: { name: Field; label: string; type: string; hint: string }[] = [
  { name: 'username', label: 'Username', type: 'text', hint: 'Try "admin" (taken) or "a" (too short).' },
  { name: 'email', label: 'Email', type: 'email', hint: 'Try johndoe@example.com: the uniqueness check queries the database.' },
  { name: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters.' },
  { name: 'passwordConfirmation', label: 'Confirm password', type: 'password', hint: 'Must match.' },
]

export default function Precognition() {
  // Binding the method + URL enables Precognition: validate() sends a
  // `Precognition: true` request that only runs the server's validation.
  const form = useForm('post', '/features/forms/precognition', {
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  }).setValidationTimeout(400)

  function submit(event: FormEvent) {
    event.preventDefault()
    form.submit({ preserveScroll: true, onSuccess: () => form.reset() })
  }

  return (
    <>
      <PageHeader
        title="Precognition"
        description="Live validation against the real server-side rules (class-validator DTO, including a database uniqueness check) without duplicating them on the client. The route is marked @Precognitive(); its handler never runs for validation requests."
      />
      <form onSubmit={submit} className="card max-w-xl space-y-5 p-6" noValidate>
        {fields.map((field) => (
          <div key={field.name}>
            <label className="label" htmlFor={field.name}>
              {field.label}
            </label>
            <div className="relative">
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                className={cn('input', form.invalid(field.name) && 'input-error', form.valid(field.name) && 'border-emerald-400')}
                value={form.data[field.name]}
                onChange={(e) => form.setData(field.name, e.target.value)}
                onBlur={() => form.validate(field.name)}
              />
              {form.valid(field.name) && <span className="absolute top-2 right-3 text-emerald-500">✓</span>}
            </div>
            {form.invalid(field.name) ? <FieldError message={form.errors[field.name]} /> : <p className="mt-1.5 text-xs text-slate-500">{field.hint}</p>}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={form.processing}>
            Create account
          </button>
          {form.validating && <Badge tone="indigo">Validating…</Badge>}
        </div>
      </form>
      <Code>{`
// Client
const form = useForm('post', '/features/forms/precognition', { username: '', ... })
<input onBlur={() => form.validate('username')} />

// Server
@Post('precognition')
@Precognitive()
createAccount(@Body() body: AccountDto) { ... }
`}</Code>
    </>
  )
}
