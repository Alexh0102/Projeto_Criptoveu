import { ArrowLeft, FlaskConical, Grid2x2, MoonStar, Settings, SunMedium, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { betaResourceDefinitions, toolDefinitions } from '../../config/tools'
import { useTheme } from '../../context/theme'
import { isNativeApp } from '../../lib/platform'
import BrandLogo from '../ui/BrandLogo'
import InstallAppButton from '../ui/InstallAppButton'
import LanguageSwitcher from './LanguageSwitcher'

type Props = {
  children: ReactNode
  showToolsDock?: boolean
}

export default function ToolPageLayout({ children, showToolsDock = false }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [activeDrawer, setActiveDrawer] = useState<'tools' | 'beta' | null>(null)
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    const checkNative = () => {
      const native = isNativeApp() || Capacitor.getPlatform() !== 'web'
      setIsNative(native)
    }

    checkNative()
    const timer = setTimeout(checkNative, 200)
    return () => clearTimeout(timer)
  }, [])

  const isHomePage = location.pathname === '/'

  const isDrawerOpen = activeDrawer !== null
  const drawerItems = activeDrawer === 'beta' ? betaResourceDefinitions : toolDefinitions

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDrawer(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  return (
    <div className="app-shell relative flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-zinc-950">
      {isNative && !isHomePage && (
        <div className="fixed inset-x-0 top-0 z-[9999] flex h-[calc(60px+env(safe-area-inset-top))] w-full shrink-0 items-center border-b border-white/20 bg-zinc-900 px-4 pt-[env(safe-area-inset-top)] shadow-2xl">
          <button
            onClick={() => navigate('/')}
            className="flex h-10 items-center gap-2.5 rounded-xl bg-cyan-500/10 px-4 text-white ring-1 ring-cyan-500/30 transition active:scale-95 sm:h-12 sm:gap-3 sm:px-5 sm:ring-2"
            aria-label={t('layout.header.back')}
          >
            <ArrowLeft className="h-5 w-5 text-cyan-400 sm:h-6 sm:w-6" />
            <span className="text-[11px] font-bold tracking-widest uppercase sm:text-sm">
              {t('layout.header.back')}
            </span>
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:34px_34px] opacity-15 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />
      <div className="cv-shell-orb cv-shell-orb-left pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
      <div className="cv-shell-orb cv-shell-orb-right pointer-events-none absolute right-0 top-8 h-80 w-80 rounded-full bg-amber-300/12 blur-3xl" />
      <div className="cv-shell-orb cv-shell-orb-bottom pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <div className={`relative mx-auto flex w-full max-w-full lg:max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-7 ${isNative && !isHomePage ? 'mt-[calc(60px+env(safe-area-inset-top))]' : ''}`}>
        <header className="cv-shell-header panel-surface sticky top-0 z-40 w-full rounded-[20px] px-2.5 py-2 transition-all duration-200 sm:top-3 sm:rounded-[26px] sm:px-5 sm:py-3">
          <div className="cv-shell-header-inner flex w-full min-w-0 items-center justify-between gap-2 sm:gap-3">
            <Link
              to="/"
              className="cv-shell-header-brand block min-w-0 flex-1 transition hover:opacity-95"
              aria-label={t('layout.header.homeAria')}
            >
              <BrandLogo variant="header" showTagline />
            </Link>

            <div className="cv-shell-header-actions flex min-w-0 max-w-full shrink-0 items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setActiveDrawer('tools')}
                className="cv-tools-trigger hidden md:flex btn-secondary justify-center px-3 sm:w-auto"
                aria-label={t('layout.header.openToolsAria')}
              >
                <Grid2x2 className="h-4 w-4" />
                {t('layout.header.tools')}
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer('beta')}
                className="hidden btn-secondary justify-center px-3 sm:inline-flex"
                aria-label={t('layout.header.openBetaAria')}
              >
                <FlaskConical className="h-4 w-4" />
                {t('layout.header.beta')}
              </button>

              <LanguageSwitcher />

              <div className="cv-header-install min-w-0 shrink-0">
                <InstallAppButton />
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="cv-header-theme btn-secondary h-11 w-11 shrink-0 justify-center rounded-full px-0 py-0 sm:h-auto sm:w-auto sm:rounded-[999px] sm:px-4 sm:py-3"
                aria-label={
                  theme === 'dark'
                    ? t('layout.header.enableLightTheme')
                    : t('layout.header.enableDarkTheme')
                }
              >
                {theme === 'dark' ? (
                  <>
                    <SunMedium className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('layout.header.theme')}</span>
                  </>
                ) : (
                  <>
                    <MoonStar className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('layout.header.theme')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className={`cv-shell-main flex-1 py-4 sm:py-7 ${showToolsDock ? 'pb-32 sm:pb-8' : 'pb-8'} [padding-bottom:max(2rem,env(safe-area-inset-bottom))]`}>{children}</main>

        <footer className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('layout.footer.summary')}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-500">
            {t('layout.footer.meta')}
          </p>
        </footer>
      </div>

      {showToolsDock && !isDrawerOpen ? (
        <div className="cv-tools-dock fixed inset-x-0 bottom-0 z-40 flex w-full justify-center px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+0.5rem)] pt-3 md:hidden">
          <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setActiveDrawer('tools')}
            className="cv-tools-dock-button btn-primary flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 px-3 py-3 text-[13px] font-bold sm:min-h-[3.5rem] sm:text-sm"
            aria-label={t('layout.header.openToolsAria')}
          >
            <Grid2x2 className="h-5 w-5 shrink-0" />
            <span className="truncate">{t('layout.header.tools')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawer('beta')}
            className="cv-tools-dock-button btn-secondary flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 px-3 py-3 text-[13px] font-bold sm:min-h-[3.5rem] sm:text-sm"
            aria-label={t('layout.header.openBetaAria')}
          >
            <FlaskConical className="h-5 w-5 shrink-0" />
            <span className="truncate">{t('layout.header.betaShort')}</span>
          </button>
          </div>
        </div>
      ) : null}

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label={t('layout.drawer.closeToolsAria')}
            onClick={() => setActiveDrawer(null)}
          />

          <div
            className={`absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl sm:inset-y-4 sm:right-4 sm:left-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:p-5 ${
              activeDrawer === 'tools'
                ? 'sm:w-[min(420px,calc(100vw-2rem))] lg:w-[min(640px,calc(100vw-2rem))]'
                : 'sm:w-[min(420px,calc(100vw-2rem))]'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 pb-3 sm:gap-3 sm:pb-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-100/80">
                  {t(`layout.drawer.${activeDrawer === 'beta' ? 'betaTitle' : 'title'}`)}
                </p>
                <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                  {t(
                    `layout.drawer.${activeDrawer === 'beta' ? 'betaDescription' : 'description'}`,
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="btn-secondary h-10 w-10 shrink-0 rounded-full px-0 py-0 sm:h-11 sm:w-11"
                aria-label={t('layout.drawer.closeDrawerAria')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-2 ${
                activeDrawer === 'tools'
                  ? 'grid grid-cols-1 gap-2 sm:gap-2.5 lg:grid-cols-2 lg:content-start'
                  : 'flex flex-col gap-2 sm:gap-2.5'
              }`}
            >
              <NavLink
                to="/"
                onClick={() => setActiveDrawer(null)}
                className={({ isActive }) =>
                  `${isActive ? 'surface-primary ring-1 ring-cyan-500/30' : 'surface-secondary'} rounded-[20px] px-3.5 py-3 text-left transition active:scale-[0.98] sm:rounded-[22px] sm:px-4 sm:py-3`
                }
              >
                <p className="text-sm font-bold text-white sm:text-base">{t('layout.drawer.home')}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-400 sm:mt-1 sm:text-xs">
                  {t('layout.drawer.homeHelper')}
                </p>
              </NavLink>

              {activeDrawer === 'tools' ? (
                <NavLink
                  to="/configuracoes"
                  onClick={() => setActiveDrawer(null)}
                  className={({ isActive }) =>
                    `${isActive ? 'surface-primary ring-1 ring-cyan-500/30' : 'surface-secondary'} rounded-[20px] px-3.5 py-3 text-left transition active:scale-[0.98] sm:rounded-[22px] sm:px-4 sm:py-3`
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-white sm:text-base">
                    <Settings className="h-4 w-4 text-cyan-200" />
                    {t('layout.drawer.settings')}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-400 sm:mt-1 sm:text-xs">
                    {t('layout.drawer.settingsHelper')}
                  </p>
                </NavLink>
              ) : null}

              {drawerItems.map((tool) => (
                <NavLink
                  key={tool.path}
                  to={tool.path}
                  onClick={() => setActiveDrawer(null)}
                  className={({ isActive }) =>
                    `${isActive ? 'surface-primary ring-1 ring-cyan-500/30' : 'surface-secondary'} rounded-[20px] px-3.5 py-3 text-left transition active:scale-[0.98] sm:rounded-[22px] sm:px-4 sm:py-3`
                  }
                >
                  <p className="text-sm font-bold text-white sm:text-base">
                    {t(`tools.${tool.id}.title`)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-400 sm:mt-1 sm:text-xs">
                    {t(`tools.${tool.id}.helper`)}
                  </p>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
