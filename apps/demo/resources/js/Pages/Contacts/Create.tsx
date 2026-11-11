import { useForm } from '@inertiajs/react'
import ContactForm, { type ContactFormData } from '@/Components/ContactForm'
import { PageHeader } from '@/Components/Demo'

export default function Create({ organizations }: { organizations?: { id: number; name: string }[] }) {
  const form = useForm<ContactFormData>({
    firstName: '',
    lastName: '',
    organizationId: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: '',
    country: '',
    postalCode: '',
    avatar: null,
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New contact"
        description="The organization list is a once prop: it is sent with the first create/edit page you open and then reused by the client for five minutes."
      />
      <ContactForm form={form} organizations={organizations} submitLabel="Create contact" onSubmit={() => form.post('/contacts')} />
    </div>
  )
}
