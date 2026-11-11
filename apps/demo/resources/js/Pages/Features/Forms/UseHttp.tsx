import { useHttp } from '@inertiajs/react'
import { type FormEvent, useState } from 'react'
import { Code, DemoCard, PageHeader } from '@/Components/Demo'
import { TextInput } from '@/Components/Fields'

interface Greeting {
  message: string
  at: string
}

interface SearchResults {
  query: string
  results: { id: number; name: string }[]
}

export default function UseHttp() {
  const greeting = useHttp<{ name: string }, Greeting>({ name: '' })
  const search = useHttp<Record<string, string>, SearchResults>({})
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<Greeting | null>(null)
  const [results, setResults] = useState<SearchResults | null>(null)

  async function greet(event: FormEvent) {
    event.preventDefault()
    // Resolves with the JSON body, or undefined when the server answered 422.
    setResponse((await greeting.post('/api/greetings')) ?? null)
  }

  async function lookup(value: string) {
    setQuery(value)
    search.cancel()

    if (!value) {
      setResults(null)
      return
    }

    try {
      setResults(await search.get(`/api/contacts?query=${encodeURIComponent(value)}`))
    } catch {
      // Superseded by a newer keystroke (cancelled).
    }
  }

  return (
    <>
      <PageHeader
        title="useHttp"
        description="useHttp has the useForm developer experience for plain JSON endpoints: no page visit happens. The NestJS validation pipe answers JSON requests with a 422 and an errors object, which useHttp exposes like form errors."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="POST /api/greetings" description="Submit an empty name to see a 422.">
          <form onSubmit={greet} className="space-y-4">
            <TextInput label="Name" name="name" value={greeting.data.name} onChange={(e) => greeting.setData('name', e.target.value)} error={greeting.errors.name} />
            <button type="submit" className="btn-primary" disabled={greeting.processing}>
              {greeting.processing ? 'Sending…' : 'Send'}
            </button>
          </form>
          {response && (
            <p className="mt-4 text-sm text-emerald-700">
              {response.message} <span className="text-slate-400">({response.at})</span>
            </p>
          )}
        </DemoCard>
        <DemoCard title="GET /api/contacts" description="Type-ahead search returning JSON.">
          <input className="input" placeholder="Search contacts…" value={query} onChange={(e) => lookup(e.target.value)} />
          {search.processing && <p className="mt-2 text-xs text-slate-500">Searching…</p>}
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {results?.results.map((contact) => <li key={contact.id}>{contact.name}</li>)}
          </ul>
        </DemoCard>
      </div>
      <Code>{`const greeting = useHttp({ name: '' })\nconst response = await greeting.post('/api/greetings')`}</Code>
    </>
  )
}
