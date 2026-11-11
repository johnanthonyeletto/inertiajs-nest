export default function TrashedBanner({ children, onRestore }: { children: string; onRestore: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
      <button type="button" className="font-medium underline" onClick={onRestore}>
        Restore
      </button>
    </div>
  )
}
