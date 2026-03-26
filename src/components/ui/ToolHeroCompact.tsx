import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: string
  description: string
  badge?: string
  actions?: ReactNode
}

export default function ToolHeroCompact({
  eyebrow,
  title,
  description,
  badge = '100% local',
  actions,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="hero-badge">
        <ShieldCheck className="h-4 w-4" />
        {badge}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.38em] text-zinc-500">{eyebrow}</p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.65rem] sm:leading-[1.05]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-[15px]">
            {description}
          </p>
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  )
}
