import { useEffect, useState } from "react"
import packageInfo from "../../package.json"
import api from "../services/api"

const FRONTEND_VERSION = packageInfo.version
const BACKEND_VERSION_FALLBACK = "1.0.0"

export default function VersionStamp({ className = "page-version" }) {
  const [backendVersion, setBackendVersion] = useState(BACKEND_VERSION_FALLBACK)

  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      return undefined
    }

    let cancelled = false

    async function loadBackendVersion() {
      try {
        const response = await api.get("/api/health")
        const version = response?.data?.version
        if (!cancelled && typeof version === "string" && version.trim()) {
          setBackendVersion(version.trim())
        }
      } catch {
        // Keep the fallback backend version visible if health is unavailable.
      }
    }

    loadBackendVersion()

    return () => {
      cancelled = true
    }
  }, [])

  return <p className={className}>v. {FRONTEND_VERSION} / v. {backendVersion}</p>
}
