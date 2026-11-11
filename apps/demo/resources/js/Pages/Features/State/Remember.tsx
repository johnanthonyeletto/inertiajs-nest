import { Link, useForm, useRemember } from '@inertiajs/react'
import { Code, DemoCard, PageHeader } from '@/Components/Demo'
import { TextInput } from '@/Components/Fields'

export default function Remember() {
  const [notes, setNotes] = useRemember('', 'features:remember:notes')
  const [count, setCount] = useRemember(0, 'features:remember:count')
  const form = useForm('features:remember:form', { search: '', category: 'all' })

  return (
    <>
      <PageHeader
        title="Remembering state"
        description="useRemember() and useForm(rememberKey, …) store component state in the browser's history state. Type something, navigate away, then press the browser back button: the state is restored."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="useRemember()">
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Type some notes…" />
          <button type="button" className="btn-secondary mt-3" onClick={() => setCount(count + 1)}>
            Clicked {count} times
          </button>
          <Code>{`const [notes, setNotes] = useRemember('', 'features:remember:notes')`}</Code>
        </DemoCard>
        <DemoCard title="useForm with a remember key">
          <div className="space-y-3">
            <TextInput label="Search" name="search" value={form.data.search} onChange={(e) => form.setData('search', e.target.value)} />
            <TextInput label="Category" name="category" value={form.data.category} onChange={(e) => form.setData('category', e.target.value)} />
          </div>
          <Code>{`const form = useForm('features:remember:form', { search: '', category: 'all' })`}</Code>
        </DemoCard>
      </div>
      <Link href="/features/state/flash" className="btn-primary mt-6">
        Navigate away →
      </Link>
    </>
  )
}
