import { Link, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AddressFields from '@/Components/AddressFields'
import { PageHeader } from '@/Components/Demo'
import { TextInput } from '@/Components/Fields'

export default function Create() {
  const form = useForm({ name: '', email: '', phone: '', address: '', city: '', region: '', country: '', postalCode: '' })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.post('/organizations')
  }

  return (
    <>
      <PageHeader title="New organization" />
      <form onSubmit={submit} className="card max-w-3xl" noValidate>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <TextInput label="Name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} className="sm:col-span-2" />
          <AddressFields data={form.data} errors={form.errors} setData={(key, value) => form.setData(key, value)} />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Link href="/organizations" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={form.processing}>
            Create organization
          </button>
        </div>
      </form>
    </>
  )
}
