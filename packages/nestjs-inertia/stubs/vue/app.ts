import { createInertiaApp } from '@inertiajs/vue3'

createInertiaApp({
  title: (title) => (title ? `${title} · {{appName}}` : '{{appName}}'),
})
