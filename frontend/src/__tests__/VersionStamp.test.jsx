import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import VersionStamp from "../components/VersionStamp"
import { BACKEND_VERSION_FALLBACK, FRONTEND_VERSION } from "../version"

const mockApiGet = vi.hoisted(() => vi.fn())

vi.mock("../services/api", () => ({
  default: {
    get: mockApiGet,
  },
}))

afterEach(() => {
  cleanup()
  mockApiGet.mockReset()
  vi.unstubAllEnvs()
})

describe("VersionStamp", () => {
  it("keeps_the_fallback_backend_version_visible_in_test_mode", () => {
    render(<VersionStamp className="custom-stamp" />)

    expect(screen.getByText(`v. ${FRONTEND_VERSION} / v. ${BACKEND_VERSION_FALLBACK}`)).toHaveClass("custom-stamp")
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  it("loads_and_displays_the_backend_version_outside_test_mode", async () => {
    vi.stubEnv("MODE", "production")
    mockApiGet.mockResolvedValue({ data: { version: "9.9.9" } })

    render(<VersionStamp />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/api/health")
    })
    expect(screen.getByText(`v. ${FRONTEND_VERSION} / v. 9.9.9`)).toBeInTheDocument()
  })

  it("keeps_the_fallback_when_the_backend_health_check_fails_or_returns_blank", async () => {
    vi.stubEnv("MODE", "production")
    mockApiGet.mockResolvedValueOnce({ data: { version: "   " } })
    const firstRender = render(<VersionStamp />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText(`v. ${FRONTEND_VERSION} / v. ${BACKEND_VERSION_FALLBACK}`)).toBeInTheDocument()

    firstRender.unmount()

    mockApiGet.mockRejectedValueOnce(new Error("down"))
    render(<VersionStamp />)
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByText(`v. ${FRONTEND_VERSION} / v. ${BACKEND_VERSION_FALLBACK}`)).toBeInTheDocument()
  })
})
