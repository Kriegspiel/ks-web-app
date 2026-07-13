import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import PromotionModal from "../components/PromotionModal"

const promotionModalCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../components/PromotionModal.css")
const promotionModalCss = readFileSync(promotionModalCssPath, "utf8")

function blockFor(source, token) {
  const start = source.indexOf(token)
  expect(start).toBeGreaterThanOrEqual(0)

  const open = source.indexOf("{", start)
  expect(open).toBeGreaterThanOrEqual(0)

  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (character === "{") {
      depth += 1
    } else if (character === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(open + 1, index)
      }
    }
  }

  throw new Error(`Unable to find CSS block for ${token}`)
}

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
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalledTimes(3)
  })

  it("does_not_cancel_when_clicking_inside_the_dialog", () => {
    const onCancel = vi.fn()
    render(<PromotionModal open onSelect={() => {}} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole("dialog"))

    expect(onCancel).not.toHaveBeenCalled()
  })

  it("keeps_dialog_text_legible_when_page_theme_is_dark", () => {
    const modalRule = blockFor(promotionModalCss, ".promotion-modal {")
    const headingRule = blockFor(promotionModalCss, ".promotion-modal h2")
    const buttonRule = blockFor(promotionModalCss, ".promotion-modal button {")

    expect(modalRule).toMatch(/color-scheme:\s*light;/)
    expect(modalRule).toMatch(/--promotion-modal-text:\s*#1e1611;/)
    expect(modalRule).toMatch(/background:\s*var\(--promotion-modal-background\);/)
    expect(headingRule).toMatch(/color:\s*var\(--promotion-modal-text\);/)
    expect(buttonRule).toMatch(/color:\s*var\(--promotion-modal-button-text\);/)
  })
})
