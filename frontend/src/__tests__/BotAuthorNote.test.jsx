import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import BotAuthorNote from "../components/BotAuthorNote"

afterEach(cleanup)

describe("BotAuthorNote", () => {
  it("preserves text and lines, links source URLs, and leaves punctuation outside links", () => {
    const note = "Model: gpt-6-luna\nSource: https://github.com/Kriegspiel/bot-openai-compatible.\nDocs: HTTP://example.com/docs!"
    const { container } = render(<BotAuthorNote note={note} />)
    expect(screen.getByRole("heading", { name: "About this bot" })).toBeInTheDocument()
    expect(screen.getByText("Provided by the bot author.")).toBeInTheDocument()
    expect(container.querySelector(".profile-author-note__text").textContent).toBe(note)
    const source = screen.getByRole("link", { name: "https://github.com/Kriegspiel/bot-openai-compatible" })
    expect(source).toHaveAttribute("href", "https://github.com/Kriegspiel/bot-openai-compatible")
    expect(source).toHaveAttribute("target", "_blank")
    expect(source).toHaveAttribute("rel", "ugc noreferrer noopener")
    expect(screen.getByRole("link", { name: "HTTP://example.com/docs" })).toHaveAttribute("href", "HTTP://example.com/docs")
  })

  it("renders HTML, executable URLs, and malformed URLs as plain text", () => {
    const note = '<script>alert(1)</script> <img src=x onerror=alert(1)> javascript:alert(1) data:text/html,hi https://.'
    const { container } = render(<BotAuthorNote note={note} />)
    expect(container.querySelector(".profile-author-note__text").textContent).toBe(note)
    expect(container.querySelector("script, img")).toBeNull()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
