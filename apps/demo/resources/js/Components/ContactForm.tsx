import { Link, type InertiaFormProps } from '@inertiajs/react'
import { type FormEvent, useEffect, useMemo } from 'react'
import AddressFields from './AddressFields'
import Avatar from './Avatar'
import { FieldError, SelectInput, TextInput } from './Fields'

export interface ContactFormData {
  firstName: string
  lastName: string
  organizationId: string
  email: string
  phone: string
  address: string
  city: string
  region: string
  country: string
  postalCode: string
  avatar: File | null
}

interface Props {
  form: InertiaFormProps<ContactFormData>
  organizations?: { id: number; name: string }[]
  avatarUrl?: string | null
  submitLabel: string
  onSubmit: () => void
}

/**
 * When `avatar` holds a `File`, `useForm` automatically sends the request as
 * `multipart/form-data` (also for PUT, which NestJS/multer handles natively)
 * and reports upload progress.
 */
export default function ContactForm({ form, organizations, avatarUrl, submitLabel, onSubmit }: Props) {
  const preview = useMemo(() => (form.data.avatar ? URL.createObjectURL(form.data.avatar) : null), [form.data.avatar])

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit} className="card" noValidate>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <TextInput label="First name" name="firstName" value={form.data.firstName} onChange={(e) => form.setData('firstName', e.target.value)} error={form.errors.firstName} />
        <TextInput label="Last name" name="lastName" value={form.data.lastName} onChange={(e) => form.setData('lastName', e.target.value)} error={form.errors.lastName} />
        <SelectInput
          label="Organization"
          name="organizationId"
          value={form.data.organizationId}
          onChange={(e) => form.setData('organizationId', e.target.value)}
          error={form.errors.organizationId}
          className="sm:col-span-2"
          disabled={!organizations}
        >
          <option value="">{organizations ? '—' : 'Loading…'}</option>
          {organizations?.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </SelectInput>
        <AddressFields data={form.data} errors={form.errors} setData={(key, value) => form.setData(key, value)} />

        <div className="sm:col-span-2">
          <span className="label">Avatar</span>
          <div className="flex items-center gap-4">
            <Avatar
              name={`${form.data.firstName || '?'} ${form.data.lastName}`}
              url={preview ?? avatarUrl}
              className="size-14"
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700"
              onChange={(e) => form.setData('avatar', e.target.files?.[0] ?? null)}
            />
          </div>
          {form.progress && (
            <progress value={form.progress.percentage} max="100" className="mt-3 h-2 w-full overflow-hidden rounded">
              {form.progress.percentage}%
            </progress>
          )}
          <FieldError message={form.errors.avatar} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
        {form.recentlySuccessful && <span className="text-sm text-emerald-600">Saved.</span>}
        <Link href="/contacts" className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn-primary" disabled={form.processing}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
