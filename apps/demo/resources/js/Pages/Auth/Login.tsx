import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { TextInput } from '@/Components/Fields'

export default function Login({ demo }: { demo: { email: string; password: string } }) {
  const form = useForm({ email: demo.email, password: demo.password, remember: false })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.post('/login', { onFinish: () => form.reset('password') })
  }

  return (
    <div className="card p-8">
      <Head title="Sign in" />
      <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">
        The demo account is pre-filled: <code className="inline">{demo.email}</code> / <code className="inline">{demo.password}</code>
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <TextInput
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          value={form.data.email}
          onChange={(event) => form.setData('email', event.target.value)}
          error={form.errors.email}
          autoFocus
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.data.password}
          onChange={(event) => form.setData('password', event.target.value)}
          error={form.errors.password}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.data.remember}
            onChange={(event) => form.setData('remember', event.target.checked)}
            className="rounded border-slate-300"
          />
          Remember me
        </label>
        <button type="submit" className="btn-primary w-full" disabled={form.processing}>
          {form.processing ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
