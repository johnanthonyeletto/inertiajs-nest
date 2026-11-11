import { cn } from '@/lib/utils'

export default function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return url ? (
    <img src={url} alt={name} className={cn('size-9 rounded-full object-cover', className)} />
  ) : (
    <span className={cn('inline-flex size-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700', className)}>
      {initials}
    </span>
  )
}
