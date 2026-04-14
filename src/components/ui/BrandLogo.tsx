type Props = {
  variant?: 'header' | 'hero'
  showTagline?: boolean
  className?: string
}

export default function BrandLogo({
  variant = 'header',
  showTagline = false,
  className = '',
}: Props) {
  const isHero = variant === 'hero'

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`.trim()}>
      <div
        className={`relative overflow-hidden border border-white/10 bg-[#06111a] shadow-[0_22px_50px_rgba(2,12,27,0.45)] ${
          isHero
            ? 'rounded-[30px] px-3 py-3 sm:px-4 sm:py-4'
            : 'rounded-[22px] px-2.5 py-2 sm:px-3 sm:py-2.5'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_58%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.10),transparent_46%)]" />
        <img
          src="/brand/criptoveu-logo.png"
          alt="Logo do CriptoVéu"
          className={`relative block w-auto ${
            isHero ? 'h-12 sm:h-14 lg:h-16' : 'h-8 sm:h-9'
          }`}
          loading="eager"
          draggable={false}
        />
      </div>

      {showTagline ? (
        <div className="min-w-0 hidden min-[540px]:block">
          <p className="truncate text-[11px] uppercase tracking-[0.32em] text-cyan-100/80">
            CriptoVéu
          </p>
          <p className="mt-1 truncate text-sm text-zinc-400">
            Privacidade local para arquivos, mensagens e imagens.
          </p>
        </div>
      ) : null}
    </div>
  )
}
