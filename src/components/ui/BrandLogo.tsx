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
    ? 'h-[88px] w-[88px] rounded-[30px] sm:h-[104px] sm:w-[104px]'
    : 'h-[52px] w-[52px] rounded-[20px] sm:h-[58px] sm:w-[58px]'

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`.trim()}>
      <div
        className={`relative overflow-hidden border border-cyan-400/12 bg-[#06111a] shadow-[0_22px_50px_rgba(2,12,27,0.45)] ${frameClasses}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_58%),radial-gradient(circle_at_bottom_right,rgba(148,230,214,0.12),transparent_46%)]" />
        <img
          src="/brand/criptoveu-logo.png"
          alt="Logo do CriptoVéu"
          className={`relative block h-full w-full object-contain ${isHero ? 'scale-[1.1]' : 'scale-[1.08]'}`}
          loading="eager"
          draggable={false}
        />
      </div>

      {showTagline ? (
        <div className="min-w-0 hidden min-[540px]:block">
          <p className={`truncate uppercase tracking-[0.32em] text-cyan-100/80 ${isHero ? 'text-xs' : 'text-[11px]'}`}>
            CriptoVéu
          </p>
          <p className={`mt-1 truncate text-zinc-400 ${isHero ? 'text-base' : 'text-sm'}`}>
            Privacidade local para arquivos, mensagens, links e imagens.
          </p>
        </div>
      ) : null}
    </div>
  )
}
