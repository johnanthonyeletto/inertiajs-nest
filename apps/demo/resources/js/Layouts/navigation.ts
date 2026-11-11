export interface NavItem {
  label: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: 'CRM',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Organizations', href: '/organizations' },
      { label: 'Contacts', href: '/contacts' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { label: 'Links', href: '/features/links' },
      { label: 'Manual visits', href: '/features/manual-visits' },
      { label: 'Redirects', href: '/features/redirects' },
      { label: 'URL fragments', href: '/features/url-fragments' },
      { label: 'Scroll management', href: '/features/scroll-management' },
      { label: 'History encryption', href: '/features/history' },
      { label: 'Instant visits', href: '/features/instant-visits' },
      { label: 'View transitions', href: '/features/view-transitions' },
    ],
  },
  {
    title: 'Forms',
    items: [
      { label: 'useForm', href: '/features/forms/use-form' },
      { label: '<Form> component', href: '/features/forms/form-component' },
      { label: 'File uploads', href: '/features/forms/file-uploads' },
      { label: 'Validation & error bags', href: '/features/forms/validation' },
      { label: 'Precognition', href: '/features/forms/precognition' },
      { label: 'Optimistic updates', href: '/features/forms/optimistic-updates' },
      { label: 'useHttp', href: '/features/forms/use-http' },
    ],
  },
  {
    title: 'Data loading',
    items: [
      { label: 'Partial reloads', href: '/features/data/partial-reloads' },
      { label: 'Deferred props', href: '/features/data/deferred-props' },
      { label: 'Optional props', href: '/features/data/optional-props' },
      { label: 'Merging props', href: '/features/data/merge-props' },
      { label: 'Infinite scroll', href: '/features/data/infinite-scroll' },
      { label: 'Once props', href: '/features/data/once-props' },
      { label: 'Polling', href: '/features/data/polling' },
      { label: 'Load when visible', href: '/features/data/when-visible' },
      { label: 'Prefetching', href: '/features/prefetching' },
    ],
  },
  {
    title: 'State & layouts',
    items: [
      { label: 'Remembering state', href: '/features/state/remember' },
      { label: 'Flash data', href: '/features/state/flash' },
      { label: 'Shared props', href: '/features/state/shared-props' },
      { label: 'Persistent layouts', href: '/features/layouts/persistent' },
      { label: 'Title & meta', href: '/features/layouts/head' },
    ],
  },
  {
    title: 'Lifecycle',
    items: [
      { label: 'Events & progress', href: '/features/events' },
      { label: 'Error handling', href: '/features/errors' },
      { label: 'Asset versioning', href: '/features/errors/asset-version' },
    ],
  },
]

export function isActive(currentUrl: string, href: string): boolean {
  const path = currentUrl.split(/[?#]/)[0]

  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`)
}
