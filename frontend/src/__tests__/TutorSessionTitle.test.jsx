import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import TutorSessionTitle from "../components/TutorSessionTitle"

const rename = vi.hoisted(() => vi.fn())
vi.mock("../services/api", () => ({ renameTutorSession: rename }))
const session = { session_id: "s1", title: "Bishop probes" }
beforeEach(() => { rename.mockReset(); rename.mockResolvedValue({ session_id: "s1", title: "My endgames" }) })
afterEach(cleanup)
function mount() {
  const onRenamed = vi.fn()
  const view = render(<TutorSessionTitle session={session} onRenamed={onRenamed} />)
  return { ...view, onRenamed }
}
function edit() { fireEvent.click(screen.getByRole("button", { name: "Rename learning session: Bishop probes" })); return screen.getByLabelText("Learning session name") }

it("shows_the_active_title_and_saves_a_trimmed_name_with_focus_restored", async () => {
  const view = mount()
  expect(screen.getByRole("heading", { name: "Bishop probes" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Rename learning session/ })).not.toHaveFocus()
  const input = edit()
  expect(input).toHaveFocus()
  expect(input).toHaveValue("Bishop probes")
  expect(input).toHaveAttribute("maxlength", "120")
  fireEvent.change(input, { target: { value: "  My endgames  " } })
  fireEvent.submit(input.closest("form"))
  await waitFor(() => expect(view.onRenamed).toHaveBeenCalledWith({ session_id: "s1", title: "My endgames" }))
  expect(rename).toHaveBeenCalledWith("s1", { title: "My endgames" })
  await waitFor(() => expect(screen.getByRole("button", { name: /Rename learning session/ })).toHaveFocus())
  view.rerender(<TutorSessionTitle session={{ ...session, title: "My endgames" }} onRenamed={view.onRenamed} />)
  expect(screen.getByRole("heading", { name: "My endgames" })).toBeInTheDocument()
})

it("cancels_with_the_icon_or_escape_and_does_not_save_blank_names", () => {
  mount()
  let input = edit()
  fireEvent.change(input, { target: { value: "Changed" } })
  fireEvent.click(screen.getByRole("button", { name: "Cancel rename" }))
  expect(screen.queryByLabelText("Learning session name")).not.toBeInTheDocument()
  input = edit()
  expect(input).toHaveValue("Bishop probes")
  fireEvent.change(input, { target: { value: "   " } })
  expect(screen.getByRole("button", { name: "Save session name" })).toBeDisabled()
  fireEvent.submit(input.closest("form"))
  expect(rename).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: "Tab" })
  expect(input).toBeInTheDocument()
  fireEvent.keyDown(input, { key: "Escape" })
  expect(screen.getByRole("button", { name: /Rename learning session/ })).toHaveFocus()
})

it("prevents_duplicate_submits_preserves_errors_and_allows_a_retry", async () => {
  let reject
  rename.mockReturnValueOnce(new Promise((_done, failure) => { reject = failure }))
  const view = mount()
  const input = edit()
  fireEvent.change(input, { target: { value: "My endgames" } })
  const form = input.closest("form")
  fireEvent.submit(form)
  expect(screen.getByRole("button", { name: "Saving session name…" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel rename" })).toBeDisabled()
  fireEvent.submit(form)
  fireEvent.keyDown(input, { key: "Escape" })
  expect(input).toBeInTheDocument()
  expect(rename).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error("Rename unavailable")))
  expect(screen.getByRole("alert")).toHaveTextContent("Rename unavailable")
  expect(input).toHaveValue("My endgames")
  fireEvent.click(screen.getByRole("button", { name: "Save session name" }))
  await waitFor(() => expect(view.onRenamed).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})
