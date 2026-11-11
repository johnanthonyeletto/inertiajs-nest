import '@inertiajs/core'

export interface User {
  id: number
  firstName: string
  lastName: string
  name: string
  email: string
}

export interface Toast {
  type: 'success' | 'error' | 'warning'
  message: string
}

export interface PaginationLink {
  url: string | null
  label: string
  active: boolean
}

export interface Paginated<T> {
  data: T[]
  meta: { currentPage: number; lastPage: number; perPage: number; total: number; from: number | null; to: number | null }
  links: PaginationLink[]
}

export interface Contact {
  id: number
  name: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  isFavorite: boolean
  avatarUrl: string | null
  organizationId: number | null
  organization: { id: number; name: string } | null
  deletedAt: string | null
}

export interface Organization {
  id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  deletedAt: string | null
}

export interface Note {
  id: number
  body: string
  createdAt: string
  author: string | null
  contact: { id: number; name: string } | null
}

declare module '@inertiajs/core' {
  export interface InertiaConfig {
    sharedPageProps: {
      appName: string
      auth: { user: User | null }
    }
    flashDataType: {
      toast?: Toast
      createdContactId?: number
      highlight?: number
      uploaded?: { field: string; name: string; size: string }[]
      submitted?: Record<string, unknown>
    }
    layoutProps: {
      title?: string
      subtitle?: string
    }
  }
}
