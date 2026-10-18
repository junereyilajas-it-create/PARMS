import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'accessor_theme'

export function applyThemeToDOM(theme: Theme) {
  const isDark = theme === 'dark'
  const root = document.documentElement
  const body = document.body

  if (isDark) {
    root.classList.add('dark')
    root.dataset.theme = 'dark'
    root.style.colorScheme = 'dark'
    if (body) {
      body.classList.add('dark')
      body.dataset.theme = 'dark'
    }
  } else {
    root.classList.remove('dark')
    root.dataset.theme = 'light'
    root.style.colorScheme = 'light'
    if (body) {
      body.classList.remove('dark')
      body.dataset.theme = 'light'
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') return saved
    } catch (e) {
      // ignore
    }
    return 'light'
  })

  // Apply immediately on mount and state change
  useEffect(() => {
    applyThemeToDOM(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch (e) {
      // ignore
    }
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    // Synchronously apply to DOM before next repaint
    applyThemeToDOM(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch (e) {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const nextTheme = prev === 'light' ? 'dark' : 'light'
      applyThemeToDOM(nextTheme)
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme)
      } catch (e) {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: nextTheme } }))
      return nextTheme
    })
  }, [])

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark'
  }), [theme, toggleTheme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
