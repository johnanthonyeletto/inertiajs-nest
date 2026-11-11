import { createInertiaApp } from '@inertiajs/react'

createInertiaApp({
  title: (title) => (title ? `${title} · {{appName}}` : '{{appName}}'),
  strictMode: true,
})
