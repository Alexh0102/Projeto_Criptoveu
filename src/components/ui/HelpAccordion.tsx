import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

type Item = {
  title: string
  content: ReactNode
}

type Props = {
  items: Item[]
  defaultOpenIndex?: number
}

export default function HelpAccordion({ items, defaultOpenIndex }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex ?? null)

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const isOpen = openIndex === index

        return (
          <div
            key={item.title}
            className={`${isOpen ? 'surface-primary border-cyan-500/20 shadow-[0_18px_40px_rgba(34,211,238,0.08)]' : 'surface-secondary'} rounded-[24px] border px-4 py-4 text-sm text-zinc-300 transition sm:px-5`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex((current) => (current === index ? null : index))}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-white">{item.title}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-500 transition ${isOpen ? 'rotate-180 text-cyan-100' : ''}`}
              />
            </button>

            {isOpen ? <div className="mt-3.5 leading-6 text-zinc-400">{item.content}</div> : null}
          </div>
        )
      })}
    </div>
  )
}