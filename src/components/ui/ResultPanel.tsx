import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export default function ResultPanel({ title, description, actions, children }: Props) {
  return (
    <section className="surface-primary w-full min-w-0 overflow-hidden rounded-[32px] p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">Resultado</p>
          <p className="mt-2 text-lg font-semibold text-white">{title}</p>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="w-full shrink-0 sm:w-auto">{actions}</div> : null}
      </div>

      <div className="mt-5 min-w-0">{children}</div>
    </section>
  )
}
