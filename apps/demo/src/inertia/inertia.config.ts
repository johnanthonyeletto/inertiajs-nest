import { defineConfig } from 'inertia-nest'
import { classValidator } from 'inertia-nest/validation/class-validator'

export const APP_NAME = 'Inertia × NestJS'

export const inertiaConfig = defineConfig({
  validator: classValidator(),

  ssr: {
    enabled: process.env.SSR_ENABLED !== 'false',
    // The same variable the `nestjs-inertia ssr:*` commands read.
    url: process.env.INERTIA_SSR_URL ?? 'http://127.0.0.1:13714',
  },
})
