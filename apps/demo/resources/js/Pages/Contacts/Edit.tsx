import { Form, Link, router, useForm } from '@inertiajs/react'
import ContactForm, { type ContactFormData } from '@/Components/ContactForm'
import { DemoCard, PageHeader } from '@/Components/Demo'
import { FieldError } from '@/Components/Fields'
import TrashedBanner from '@/Components/TrashedBanner'
import { cn, formatDate } from '@/lib/utils'
import type { Contact, Note } from '@/types/global'

interface Props {
  contact: Contact
  organizations?: { id: number; name: string }[]
  notes: Note[]
}

export default function Edit({ contact, organizations, notes }: Props) {
  const form = useForm<ContactFormData>({
    firstName: contact.firstName,
    lastName: contact.lastName,
    organizationId: contact.organizationId ? String(contact.organizationId) : '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    address: contact.address ?? '',
    city: contact.city ?? '',
    region: contact.region ?? '',
    country: contact.country ?? '',
    postalCode: contact.postalCode ?? '',
    avatar: null,
  })

  function destroy() {
    if (confirm('Are you sure you want to delete this contact?')) {
      router.delete(`/contacts/${contact.id}`, { preserveScroll: true })
    }
  }

  function toggleFavorite() {
    // Optimistic update: the star flips instantly and rolls back if the request fails.
    router
      .optimistic<Props>((props) => ({ contact: { ...props.contact, isFavorite: !props.contact.isFavorite } }))
      .post(`/contacts/${contact.id}/favorite`, {}, { preserveScroll: true, only: ['contact'] })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={contact.name}
        description={
          <Link href="/contacts" className="link">
            ← Contacts
          </Link>
        }
        actions={
          <button type="button" onClick={toggleFavorite} className="btn-secondary" aria-pressed={contact.isFavorite}>
            <span className={cn(contact.isFavorite ? 'text-amber-500' : 'text-slate-300')}>★</span>
            {contact.isFavorite ? 'Favorite' : 'Add to favorites'}
          </button>
        }
      />
      {contact.deletedAt && (
        <TrashedBanner onRestore={() => router.put(`/contacts/${contact.id}/restore`)}>This contact has been deleted.</TrashedBanner>
      )}

      <ContactForm
        form={form}
        organizations={organizations}
        avatarUrl={contact.avatarUrl}
        submitLabel="Update contact"
        onSubmit={() => form.put(`/contacts/${contact.id}`, { preserveScroll: true, onSuccess: () => form.setData('avatar', null) })}
      />

      {!contact.deletedAt && (
        <button type="button" className="mt-4 text-sm font-medium text-rose-600 hover:underline" onClick={destroy}>
          Delete contact
        </button>
      )}

      <DemoCard
        title="Notes"
        description="Added with the <Form> component: it serializes its inputs, resets on success, and only reloads the notes prop."
        className="mt-8"
      >
        <Form
          action={`/contacts/${contact.id}/notes`}
          method="post"
          options={{ preserveScroll: true, only: ['notes'] }}
          resetOnSuccess
          className="space-y-3"
        >
          {({ errors, processing }) => (
            <>
              <textarea name="body" rows={3} className={cn('input', errors.body && 'input-error')} placeholder="Write a note…" />
              <FieldError message={errors.body} />
              <button type="submit" className="btn-primary" disabled={processing}>
                Add note
              </button>
            </>
          )}
        </Form>

        <ul className="mt-6 divide-y divide-slate-100">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <div className="text-xs text-slate-500">
                {note.author} · {formatDate(note.createdAt)}
              </div>
              <p className="mt-1 text-sm text-slate-700">{note.body}</p>
            </li>
          ))}
          {notes.length === 0 && <li className="py-3 text-sm text-slate-500">No notes yet.</li>}
        </ul>
      </DemoCard>
    </div>
  )
}
