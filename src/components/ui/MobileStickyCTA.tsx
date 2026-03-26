import { LoaderCircle } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'

type Props = {
  label: string
  icon?: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  loading?: boolean
}

export default function MobileStickyCTA({
  label,
  icon,
  onClick,
  disabled = false,
  loading = false,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/88 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl lg:hidden">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="btn-primary pointer-events-auto min-h-[56px] w-full text-base"
      >
        {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : icon}
        {label}
      </button>
    </div>
  )
}
