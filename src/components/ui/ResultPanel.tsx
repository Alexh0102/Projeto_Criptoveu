import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export default function ResultPanel({ title, description, actions, children }: Props) {
  return (
    <section className="surface-primary rounded-[32px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">Resultado</p>
          <p className="mt-2 text-lg font-semibold text-white">{title}</p>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}
