import { Head } from '@inertiajs/react'

export default function Home({ message }: { message: string }) {
  return (
    <main>
      <Head title="Home" />
      <h1>{message}</h1>
    </main>
  )
}
