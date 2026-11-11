import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function FieldError({ message }: { message?: string | string[] }) {
  if (!message) return null

  return <p className="mt-1.5 text-sm text-rose-600">{Array.isArray(message) ? message.join(' ') : message}</p>
}

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
}

export function TextInput({ label, error, hint, className, id, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? props.name

  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <input id={inputId} className={cn('input', error && 'input-error')} {...props} />
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

export function TextArea({ label, error, className, id, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? props.name

  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <textarea id={inputId} className={cn('input', error && 'input-error')} {...props} />
      <FieldError message={error} />
    </div>
  )
}

export function SelectInput({
  label,
  error,
  className,
  id,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id ?? props.name

  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <select id={inputId} className={cn('input', error && 'input-error')} {...props}>
        {children}
      </select>
      <FieldError message={error} />
    </div>
  )
}
