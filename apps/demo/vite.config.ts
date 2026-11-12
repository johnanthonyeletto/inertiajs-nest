import { resolve } from 'node:path'
import inertia from '@inertiajs/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import nestInertia from '@johnanthonyeletto/nestjs-inertia/vite'
import { defineConfig } from 'vite'

const DEV_SERVER_PORT = Number(process.env.VITE_PORT ?? 5173)
// The production SSR server's port (see `npm run start:ssr` and SSR_URL).
const SSR_PORT = Number(process.env.SSR_PORT ?? 13714)

export default defineConfig({
  plugins: [inertia({ ssr: { port: SSR_PORT } }), react(), tailwindcss(), nestInertia({ input: 'resources/js/app.tsx' })],
  resolve: {
    alias: { '@': resolve('resources/js') },
  },
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    origin: `http://localhost:${DEV_SERVER_PORT}`,
  },
})
