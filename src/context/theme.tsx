/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  shellStyle: {
    background: string
    color: string
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const savedTheme = window.localStorage.getItem('criptify-theme')

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const LIGHT_BACKGROUND =
  'radial-gradient(circle at 14% 0%, rgba(56, 189, 248, 0.16), transparent 30%), radial-gradient(circle at 88% 10%, rgba(34, 197, 94, 0.12), transparent 22%), linear-gradient(180deg, #eef4f7 0%, #e4edf3 100%)'

const DARK_BACKGROUND =
  'radial-gradient(circle at top, rgba(82, 224, 255, 0.12), transparent 28%), radial-gradient(circle at 90% 10%, rgba(251, 191, 36, 0.12), transparent 26%), #05070b'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)

  useEffect(() => {
    const nextBackground = theme === 'light' ? LIGHT_BACKGROUND : DARK_BACKGROUND
    const nextColor = theme === 'light' ? '#12263c' : '#f5f7fb'

    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('criptify-theme', theme)
    document.body.dataset.theme = theme
    document.body.style.background = nextBackground
    document.body.style.color = nextColor
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
      shellStyle:
        theme === 'light'
          ? {
              background: LIGHT_BACKGROUND,
              color: '#12263c',
            }
          : {
              background: DARK_BACKGROUND,
              color: '#f5f7fb',
            },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider.')
  }

  return value
}
