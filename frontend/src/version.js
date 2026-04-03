import packageInfo from "../package.json"

export const FRONTEND_VERSION = packageInfo.version
export const BACKEND_VERSION_FALLBACK = "1.0.0"
export const TEST_VERSION_STAMP = `v. ${FRONTEND_VERSION} / v. ${BACKEND_VERSION_FALLBACK}`
