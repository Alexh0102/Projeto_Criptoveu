import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

type Props = {
  title?: string
  helper?: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function AdvancedOptions({
  title = 'Opções avançadas',
  helper,
  defaultOpen = false,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className="surface-technical rounded-[28px]">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          {helper ? <p className="mt-1 text-sm text-zinc-400">{helper}</p> : null}
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-zinc-400 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? <div className="border-t border-white/10 px-5 py-4">{children}</div> : null}
    </section>
  )
}
