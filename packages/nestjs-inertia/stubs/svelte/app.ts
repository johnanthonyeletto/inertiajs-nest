import { createInertiaApp } from '@inertiajs/svelte'

createInertiaApp({
  title: (title) => (title ? `${title} · {{appName}}` : '{{appName}}'),
})
