import type { ReactNode } from 'react'
import FlashToaster from '@/Components/FlashToaster'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10" />
          <span className="text-lg font-semibold text-slate-900">Inertia × NestJS</span>
        </div>
        {children}
      </div>
      <FlashToaster />
    </div>
  )
}
