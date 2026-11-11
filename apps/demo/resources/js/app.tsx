import '../css/app.css'
import type { SharedPageProps } from '@inertiajs/core'
import { createInertiaApp } from '@inertiajs/react'
import AppLayout from './Layouts/AppLayout'
import AuthLayout from './Layouts/AuthLayout'

createInertiaApp({
  title: (title) => (title ? `${title} · Inertia × NestJS` : 'Inertia × NestJS'),
  // Resolved by the @inertiajs/vite plugin into lazily-loaded `./Pages/**` components.
  pages: './Pages',
  // The default persistent layout. Pages may override it with `Page.layout`.
  layout: (name, page) => {
    const guest = !(page.props as unknown as SharedPageProps).auth.user

    return name.startsWith('Auth/') || (name === 'Error' && guest) ? AuthLayout : AppLayout
  },
  progress: { color: '#6366f1', delay: 150 },
  strictMode: true,
})
