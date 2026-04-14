
import { createContext, useCallback, useEffect, useMemo, useState } from "react"

export const THEME_STORAGE_KEY = "kriegspiel-theme"
const ThemeContext = createContext(null)
const THEMES = new Set(["light", "dark"])

function readStoredTheme() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.has(value) ? value : null
  } catch {
    return null
  }
}

function getSystemTheme() {
  return "light"
}

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.body?.setAttribute("data-theme", theme)

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme === "dark" ? "#100d0a" : "#f7efe3")
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    applyTheme(theme)
    if (typeof window === "undefined") {
      return
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore storage failures
    }
  }, [theme])

  const setExplicitTheme = useCallback((nextTheme) => {
    setTheme((currentTheme) => {
      const resolvedTheme = THEMES.has(nextTheme) ? nextTheme : currentTheme
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme)
        } catch {
          // ignore storage failures
        }
      }
      return resolvedTheme
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark"
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
        } catch {
          // ignore storage failures
        }
      }
      return nextTheme
    })
  }, [])

  const value = useMemo(() => ({
    theme,
    isDark: theme === "dark",
    setTheme: setExplicitTheme,
    toggleTheme,
  }), [theme, setExplicitTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeContext
