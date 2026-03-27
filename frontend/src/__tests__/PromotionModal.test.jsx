import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import PromotionModal from "../components/PromotionModal"

afterEach(() => {
  cleanup()
})

describe("PromotionModal", () => {
  it("renders_choices_and_selects_suffix", () => {
    const onSelect = vi.fn()
    render(<PromotionModal open onSelect={onSelect} onCancel={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Queen" }))

    expect(onSelect).toHaveBeenCalledWith("q")
  })

  it("cancels_on_escape_and_backdrop", () => {
    const onCancel = vi.fn()
    render(<PromotionModal open onSelect={() => {}} onCancel={onCancel} />)

    fireEvent.keyDown(window, { key: "Escape" })
    fireEvent.click(screen.getByRole("presentation"))

    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
