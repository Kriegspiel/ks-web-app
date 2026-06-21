import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { captureCampaignVisit } from "../attribution"

export default function AttributionCapture() {
  const location = useLocation()
  const { hash, pathname, search } = location

  useEffect(() => {
    captureCampaignVisit({ hash, pathname, search }).catch(() => {})
  }, [hash, pathname, search])

  return null
}
