import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

type Item = {
  title: string
  content: ReactNode
}

type Props = {
  items: Item[]
}

export default function HelpAccordion({ items }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details
          key={item.title}
          className="surface-secondary rounded-[28px] p-5 text-sm text-zinc-300"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-white">
            {item.title}
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition" />
          </summary>
          <div className="mt-4 leading-7 text-zinc-400">{item.content}</div>
        </details>
      ))}
    </div>
  )
}
