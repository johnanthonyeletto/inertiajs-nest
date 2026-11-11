import { Link, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AddressFields from '@/Components/AddressFields'
import { DemoCard, PageHeader } from '@/Components/Demo'
import { TextInput } from '@/Components/Fields'
import TrashedBanner from '@/Components/TrashedBanner'
import type { Contact, Organization } from '@/types/global'

export default function Edit({ organization, contacts }: { organization: Organization; contacts: Contact[] }) {
  const form = useForm({
    name: organization.name,
    email: organization.email ?? '',
    phone: organization.phone ?? '',
    address: organization.address ?? '',
    city: organization.city ?? '',
    region: organization.region ?? '',
    country: organization.country ?? '',
    postalCode: organization.postalCode ?? '',
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.put(`/organizations/${organization.id}`, { preserveScroll: true })
  }

  function destroy() {
    if (confirm('Are you sure you want to delete this organization?')) {
      router.delete(`/organizations/${organization.id}`)
    }
  }

  return (
    <>
      <PageHeader
        title={organization.name}
        description={
          <Link href="/organizations" className="link">
            ← Organizations
          </Link>
        }
      />
      {organization.deletedAt && (
        <TrashedBanner onRestore={() => router.put(`/organizations/${organization.id}/restore`)}>
          This organization has been deleted.
        </TrashedBanner>
      )}

      <form onSubmit={submit} className="card max-w-3xl" noValidate>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <TextInput label="Name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} className="sm:col-span-2" />
          <AddressFields data={form.data} errors={form.errors} setData={(key, value) => form.setData(key, value)} />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          {!organization.deletedAt ? (
            <button type="button" className="text-sm font-medium text-rose-600 hover:underline" onClick={destroy}>
              Delete organization
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {form.recentlySuccessful && <span className="text-sm text-emerald-600">Saved.</span>}
            <button type="submit" className="btn-primary" disabled={form.processing || !form.isDirty}>
              Update organization
            </button>
          </div>
        </div>
      </form>

      <DemoCard title="Contacts" className="mt-8 max-w-3xl">
        <ul className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/contacts/${contact.id}/edit`} className="link">
                {contact.name}
              </Link>
              <span className="text-slate-500">{contact.email}</span>
            </li>
          ))}
          {contacts.length === 0 && <li className="py-2 text-sm text-slate-500">No contacts.</li>}
        </ul>
      </DemoCard>
    </>
  )
}
