import { Grid2x2, MoonStar, SunMedium, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { toolDefinitions } from '../../config/tools'
import { useTheme } from '../../context/theme'
import BrandLogo from '../ui/BrandLogo'

type Props = {
  children: ReactNode
  showToolsDock?: boolean
}

export default function ToolPageLayout({ children, showToolsDock = false }: Props) {
  const { theme, toggleTheme, shellStyle } = useTheme()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  return (
    <div className="app-shell relative min-h-screen overflow-hidden" style={shellStyle}>
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:34px_34px] opacity-15 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />
      <div className="cv-shell-orb cv-shell-orb-left pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
      <div className="cv-shell-orb cv-shell-orb-right pointer-events-none absolute right-0 top-8 h-80 w-80 rounded-full bg-amber-300/12 blur-3xl" />
      <div className="cv-shell-orb cv-shell-orb-bottom pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
        <header className="cv-shell-header panel-surface sticky top-3 z-40 rounded-[26px] px-4 py-3 sm:px-5">
          <div className="cv-shell-header-inner flex items-center justify-between gap-3">
            <Link
              to="/"
              className="cv-shell-header-brand block min-w-0 flex-1 transition hover:opacity-95"
              aria-label="Abrir a home do CriptoVéu"
            >
              <BrandLogo variant="header" showTagline />
            </Link>

            <div className="cv-shell-header-actions flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="cv-tools-trigger btn-secondary justify-center px-3 sm:w-auto"
                aria-label="Abrir lista de ferramentas"
              >
                <Grid2x2 className="h-4 w-4" />
                Ferramentas
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="btn-secondary h-11 w-11 shrink-0 justify-center rounded-full px-0 py-0 sm:h-auto sm:w-auto sm:rounded-[999px] sm:px-4 sm:py-3"
                aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                {theme === 'dark' ? (
                  <>
                    <SunMedium className="h-4 w-4" />
                    <span className="hidden sm:inline">Tema</span>
                  </>
                ) : (
                  <>
                    <MoonStar className="h-4 w-4" />
                    <span className="hidden sm:inline">Tema</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className={`flex-1 py-4 sm:py-7 ${showToolsDock ? 'pb-28 sm:pb-7' : ''}`}>{children}</main>

        <footer className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Privacidade local para arquivos, mensagens, QR Codes e imagens.</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-500">
            Ferramentas locais • Fluxo direto • Uso no navegador
          </p>
        </footer>
      </div>

      {showToolsDock && !isDrawerOpen ? (
        <div className="cv-tools-dock fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="cv-tools-dock-button btn-primary w-full max-w-[360px] justify-center"
            aria-label="Abrir ferramentas"
          >
            <Grid2x2 className="h-4 w-4" />
            Ferramentas
          </button>
        </div>
      ) : null}

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar menu de ferramentas"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] border border-white/10 bg-zinc-950/95 p-5 backdrop-blur-xl sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[420px] sm:rounded-[32px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">Ferramentas</p>
                <p className="mt-2 text-sm text-zinc-400">Escolha a tela certa para a sua tarefa.</p>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="btn-secondary h-11 w-11 rounded-full px-0 py-0"
                aria-label="Fechar drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <NavLink
                to="/"
                onClick={() => setIsDrawerOpen(false)}
                className={({ isActive }) =>
                  `${isActive ? 'surface-primary' : 'surface-secondary'} rounded-[24px] px-4 py-4 text-left transition`
                }
              >
                <p className="text-sm font-medium text-white">Home</p>
                <p className="mt-1 text-sm text-zinc-400">Voltar para a visão geral do CriptoVéu.</p>
              </NavLink>

              {toolDefinitions.map((tool) => (
                <NavLink
                  key={tool.path}
                  to={tool.path}
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) =>
                    `${isActive ? 'surface-primary' : 'surface-secondary'} rounded-[24px] px-4 py-4 text-left transition`
                  }
                >
                  <p className="text-sm font-medium text-white">{tool.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{tool.helper}</p>
                </NavLink>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Transparência</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { to: '/privacidade', label: 'Privacidade' },
                  { to: '/seguranca', label: 'Segurança' },
                  { to: '/detalhes-tecnicos', label: 'Detalhes técnicos' },
                  { to: '/sobre', label: 'Sobre o projeto' },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) =>
                      `${isActive ? 'surface-primary' : 'surface-secondary'} rounded-[20px] px-4 py-3 text-sm font-medium text-white transition`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
