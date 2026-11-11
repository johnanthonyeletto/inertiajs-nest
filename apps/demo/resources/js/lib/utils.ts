export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}
