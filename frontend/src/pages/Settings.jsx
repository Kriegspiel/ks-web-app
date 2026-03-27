import { useEffect, useState } from "react"
import { me, userApi } from "../services/api"
import "./Settings.css"

const DEFAULT_SETTINGS = {
  board_theme: "default",
  piece_set: "cburnett",
  sound_enabled: true,
  auto_ask_any: false,
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      setLoading(true)
      setError("")
      try {
        const payload = await me()
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...(payload?.settings ?? {}) })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load your settings.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSettings()
    return () => { cancelled = true }
  }, [])

  function updateField(key, value) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const updated = await userApi.updateSettings(settings)
      setSettings({ ...DEFAULT_SETTINGS, ...(updated ?? {}) })
      setSuccess("Settings saved.")
    } catch (apiError) {
      setError(apiError?.message ?? "Unable to save settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell settings-page">
      <h1>Settings</h1>
      {loading ? <p>Loading settings…</p> : (
        <form onSubmit={handleSubmit} className="settings-form">
          <label htmlFor="board-theme">Board theme</label>
          <select id="board-theme" value={settings.board_theme} onChange={(event) => updateField("board_theme", event.target.value)}>
            <option value="default">Default</option>
            <option value="wood">Wood</option>
            <option value="high-contrast">High contrast</option>
          </select>

          <label htmlFor="piece-set">Piece set</label>
          <select id="piece-set" value={settings.piece_set} onChange={(event) => updateField("piece_set", event.target.value)}>
            <option value="cburnett">Cburnett</option>
            <option value="alpha">Alpha</option>
            <option value="merida">Merida</option>
          </select>

          <label className="settings-toggle">
            <input type="checkbox" checked={Boolean(settings.sound_enabled)} onChange={(event) => updateField("sound_enabled", event.target.checked)} />
            Enable sound
          </label>

          <label className="settings-toggle">
            <input type="checkbox" checked={Boolean(settings.auto_ask_any)} onChange={(event) => updateField("auto_ask_any", event.target.checked)} />
            Auto ask-any prompts
          </label>

          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
        </form>
      )}

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {success ? <p role="status" className="settings-success">{success}</p> : null}
    </main>
  )
}
