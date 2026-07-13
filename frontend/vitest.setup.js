import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from "vitest"

function installScrollMocks() {
  if (typeof window === "undefined") return
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
}

installScrollMocks()

beforeEach(() => {
  installScrollMocks()
})

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
