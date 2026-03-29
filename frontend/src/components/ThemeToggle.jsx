
import { useTheme } from "../hooks/useTheme"

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  const nextTheme = isDark ? "light" : "dark"

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={isDark}
      title={`Switch to ${nextTheme} theme`}
    >
      <img className="theme-toggle__logo" src="/logo-theme-toggle.png" alt="" />
    </button>
  )
}
