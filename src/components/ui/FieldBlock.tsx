import type { ReactNode } from 'react'

type Props = {
  label: string
  helper?: string
  error?: string | null
  htmlFor?: string
  children: ReactNode
}

export default function FieldBlock({ label, helper, error, htmlFor, children }: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-white">
          {label}
        </label>
        {helper ? <p className="text-xs leading-6 text-zinc-400 sm:text-sm">{helper}</p> : null}
      </div>

      {children}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}
