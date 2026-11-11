import { usePage } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import type { Toast } from '@/types/global'
import { cn } from '@/lib/utils'

interface VisibleToast extends Toast {
  id: number
}

const styles: Record<Toast['type'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

function ToastItem({ toast, onDismiss }: { toast: VisibleToast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn('pointer-events-auto rounded-lg border px-4 py-3 text-left text-sm shadow-lg', styles[toast.type])}
    >
      {toast.message}
    </button>
  )
}

/**
 * Shows `flash.toast` messages. Flash data arrives on `page.flash` (not in
 * props), is never persisted in history state, and is replaced on every
 * response, so each new flash object is shown exactly once.
 */
export default function FlashToaster() {
  const { flash } = usePage()
  const [toasts, setToasts] = useState<VisibleToast[]>([])
  const seen = useRef(new WeakSet<object>())

  useEffect(() => {
    if (!flash.toast || seen.current.has(flash)) return

    seen.current.add(flash)
    setToasts((current) => [...current, { ...flash.toast!, id: Date.now() + Math.random() }])
  }, [flash])

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => setToasts((current) => current.filter(({ id }) => id !== toast.id))} />
      ))}
    </div>
  )
}
