import React, { useEffect } from 'react'

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
    // Save current theme setting from localStorage
    const savedTheme = localStorage.getItem('accessor_theme') || 'light'

    // Force light mode on document root while viewing isolated page
    document.documentElement.dataset.theme = 'light'
    document.documentElement.classList.remove('dark')
    document.body.dataset.theme = 'light'
    document.body.classList.remove('dark')

    return () => {
      // When navigating away to dashboard/other pages, restore user's saved theme preference
      const currentSavedTheme = localStorage.getItem('accessor_theme') || savedTheme
      document.documentElement.dataset.theme = currentSavedTheme
      document.documentElement.classList.toggle('dark', currentSavedTheme === 'dark')
      document.body.dataset.theme = currentSavedTheme
      document.body.classList.toggle('dark', currentSavedTheme === 'dark')
    }
  }, [])

  return (
    <div className={`theme-isolated ${className}`} data-theme="light" style={{ colorScheme: 'light' }}>
      {children}
    </div>
  )
}
