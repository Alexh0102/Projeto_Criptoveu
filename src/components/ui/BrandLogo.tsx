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
  const frameClasses = isHero
    ? 'h-[76px] w-[76px] rounded-[26px] sm:h-[108px] sm:w-[108px]'
    : 'h-[52px] w-[52px] rounded-[20px] sm:h-[62px] sm:w-[62px]'
  const coreClasses = isHero
    ? 'rounded-[24px] sm:rounded-[30px]'
    : 'rounded-[20px] sm:rounded-[21px]'
  const wrapperClasses = isHero
    ? 'flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center'
    : 'flex min-w-0 items-center gap-3 sm:gap-3.5'

  return (
    <div className={`${wrapperClasses} ${className}`.trim()}>
      <div className={`brand-logo-frame ${frameClasses}`}>
        <div className="brand-logo-glow" />
        <div className="brand-logo-ring" />

        <div
          className={`relative h-full w-full overflow-hidden border border-cyan-300/18 bg-[#06111a] shadow-[0_22px_50px_rgba(2,12,27,0.45)] ${coreClasses}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_58%),radial-gradient(circle_at_bottom_right,rgba(148,230,214,0.12),transparent_46%)]" />
          <img
            src="/brand/criptoveu-logo.png"
            alt="Logo do CriptoVéu"
            className={`relative block h-full w-full object-contain ${isHero ? 'scale-[1.12]' : 'scale-[1.1]'}`}
            loading="eager"
            draggable={false}
          />
        </div>
      </div>

      {showTagline ? (
        <div className="min-w-0">
          <p
            className={`uppercase tracking-[0.32em] text-cyan-100/80 ${isHero ? 'text-xs sm:text-[13px]' : 'truncate text-[11px]'}`}
          >
            CriptoVéu
          </p>
          <p
            className={`text-zinc-400 ${isHero ? 'mt-2 max-w-xl text-sm leading-6 sm:text-base' : 'mt-1 hidden text-sm min-[420px]:block'}`}
          >
            Privacidade local para arquivos, mensagens, links e imagens.
          </p>
        </div>
      ) : null}
    </div>
  )
}
