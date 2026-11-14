
import { useTheme } from "../hooks/useTheme"

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      <img className="theme-toggle__logo" src="/logo-theme-toggle-96.webp" width="96" height="96" alt="" draggable={false} />
    </button>
  )
}
