import React, { useEffect } from 'react'
import { applyThemeToDOM } from '../../contexts/ThemeContext'

interface IsolatedThemeWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * IsolatedThemeWrapper ensures that public-facing pages (such as Landing and Login)
 * remain completely independent of dashboard dark mode settings.
 * It forces light mode on the document root while mounted,
 * and restores the user's dashboard theme preference upon navigating away.
 */
export function IsolatedThemeWrapper({ children, className = '' }: IsolatedThemeWrapperProps) {
  useEffect(() => {
    const savedTheme = (localStorage.getItem('accessor_theme') as 'light' | 'dark') || 'light'

    // Force light mode on document root while viewing isolated page
    applyThemeToDOM('light')

    return () => {
      // When navigating away to dashboard/other pages, restore user's saved theme preference
      const currentSavedTheme = (localStorage.getItem('accessor_theme') as 'light' | 'dark') || savedTheme
      applyThemeToDOM(currentSavedTheme)
    }
  }, [])

  return (
    <div className={`theme-isolated ${className}`} data-theme="light" style={{ colorScheme: 'light' }}>
      {children}
    </div>
  )
}
