import { useForm, usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { DemoCard, PageHeader } from '@/Components/Demo'
import { FieldError, TextInput } from '@/Components/Fields'

interface UploadForm {
  title: string
  files: File[]
}

export default function FileUploads() {
  const { flash } = usePage()
  const form = useForm<UploadForm>({ title: '', files: [] })

  function submit(event: FormEvent) {
    event.preventDefault()
    form.post('/features/forms/file-uploads', { preserveScroll: true, onSuccess: () => form.reset() })
  }

  return (
    <>
      <PageHeader
        title="File uploads"
        description="When form data contains files, Inertia sends multipart/form-data automatically and reports upload progress. NestJS parses it with multer's AnyFilesInterceptor."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="card space-y-5 p-6">
          <TextInput label="Title" name="title" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} error={form.errors.title} />
          <div>
            <label className="label" htmlFor="files">Files</label>
            <input
              id="files"
              type="file"
              multiple
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700"
              onChange={(e) => form.setData('files', Array.from(e.target.files ?? []))}
            />
            <FieldError message={form.errors.files} />
          </div>
          {form.progress && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${form.progress.percentage}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{form.progress.percentage}% uploaded</p>
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={form.processing}>
              Upload
            </button>
            {form.processing && (
              <button type="button" className="btn-secondary" onClick={() => form.cancel()}>
                Cancel
              </button>
            )}
          </div>
        </form>
        <DemoCard title="Server response" description="The server lists what it received via flash data.">
          {flash.uploaded ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {flash.uploaded.map((file) => (
                <li key={`${file.field}-${file.name}`} className="flex justify-between py-2">
                  <span className="text-slate-700">{file.name}</span>
                  <span className="text-slate-500">
                    {file.field} · {file.size}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing uploaded yet.</p>
          )}
        </DemoCard>
      </div>
    </>
  )
}
