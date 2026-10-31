import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import TutorSidebar from "../components/TutorSidebar"
import TutorIconButton from "../components/TutorIconButton"

let change
let matches
beforeEach(() => {
  matches = true
  vi.spyOn(window, "matchMedia").mockImplementation(() => ({ matches, addEventListener: (_name, callback) => { change = callback }, removeEventListener: vi.fn() }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.style.overflow = "" })

function mount(overrides = {}) {
  const props = { sessions: [{ session_id: "s1", title: "Reading evidence", status: "idle" }], sessionId: "s1", gameCode: "ABC234",
    history: { total: 1, next_offset: null, games: [{ game_code: "ABC234", opponent: "Player", color: "white", variant: "rand", completed_moves: 10, result: { winner: "white" } }] },
    historyLoading: false, onLoadMore: vi.fn(), onSession: vi.fn(), onNew: vi.fn(), title: <h2>Current lesson</h2>, ...overrides }
  const view = render(<MemoryRouter><TutorSidebar {...props}><p>Teaching workspace</p></TutorSidebar></MemoryRouter>)
  return { ...view, props }
}

it("docks_compact_navigation_on_wide_screens_and_allows_collapsing_without_losing_the_lesson", () => {
  const { props, container } = mount()
  expect(container.querySelector(".coach-workspace")).toHaveClass("has-sidebar")
  const sidebar = screen.getByRole("complementary", { name: "Learning navigation" })
  expect(within(sidebar).getByRole("heading", { name: "Your games 1" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Reading evidence idle" })).toHaveAttribute("aria-current", "true")
  fireEvent.click(screen.getByRole("button", { name: "Reading evidence idle" }))
  expect(props.onSession).toHaveBeenCalledWith("s1")
  fireEvent.click(screen.getByRole("button", { name: "New session" }))
  expect(props.onNew).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("link", { name: /vs\. Player Win/ }))
  expect(screen.getByRole("complementary")).toBeInTheDocument()
  fireEvent.click(container.querySelector(".coach-workspace-bar button"))
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  expect(screen.getByText("Teaching workspace")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Show menu" }))
  const toggle = within(screen.getByRole("complementary")).getByRole("button", { name: "Hide menu" })
  expect(toggle).toHaveAttribute("aria-expanded", "true")
  expect(toggle.querySelector("svg rect")).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.getByRole("button", { name: "Show menu" })).toHaveAttribute("aria-expanded", "false")
  expect(screen.getByRole("button", { name: "Show menu" })).toHaveFocus()
})

it("uses_a_native_modal_drawer_on_narrow_screens_with_cancel_backdrop_selection_and_resize_cleanup", () => {
  matches = false
  const show = vi.fn(function () { this.open = true; this.querySelector("button").focus() })
  const close = vi.fn(function () { this.open = false })
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: show })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close })
  document.body.style.overflow = "auto"
  const { props, container, unmount } = mount()
  const trigger = screen.getByRole("button", { name: "Show menu" })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: /Your games/ })).not.toBeInTheDocument()
  function open() { fireEvent.click(trigger); return screen.getByRole("dialog", { name: "Learning navigation" }) }
  let drawer = open()
  expect(show).toHaveBeenCalledTimes(1)
  expect(document.body.style.overflow).toBe("hidden")
  const toggle = within(drawer).getByRole("button", { name: "Hide menu" })
  expect(toggle).toHaveFocus()
  expect(toggle).toHaveAttribute("aria-controls", drawer.id)
  expect(toggle.querySelector("svg rect")).toBeInTheDocument()
  fireEvent.click(within(drawer).getByRole("heading", { name: /Your games/ }))
  expect(drawer).toBeVisible()
  const cancelled = fireEvent(drawer, new Event("cancel", { cancelable: true }))
  expect(cancelled).toBe(false)
  expect(document.body.style.overflow).toBe("auto")
  expect(trigger).toHaveFocus()
  drawer = open()
  fireEvent.click(drawer)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  drawer = open()
  fireEvent.click(within(drawer).getByRole("button", { name: "Reading evidence idle" }))
  expect(props.onSession).toHaveBeenCalledWith("s1")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  drawer = open()
  fireEvent.click(within(drawer).getByRole("button", { name: "New session" }))
  expect(props.onNew).toHaveBeenCalledTimes(1)
  drawer = open()
  fireEvent.click(within(drawer).getByRole("link", { name: /vs\. Player/ }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  open()
  act(() => change({ matches: true }))
  expect(container.querySelector(".coach-workspace")).toHaveClass("has-sidebar")
  expect(document.body.style.overflow).toBe("auto")
  act(() => change({ matches: false }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  open()
  unmount()
  expect(document.body.style.overflow).toBe("auto")
  expect(close).toHaveBeenCalledTimes(7)
})

it("shows_instant_hover_and_focus_tooltips_even_for_disabled_icons_and_dismisses_them", () => {
  const click = vi.fn()
  const view = render(<TutorIconButton icon="hint" label="Give me a hint" onClick={click} disabled />)
  let button = screen.getByRole("button")
  const wrapper = button.parentElement
  expect(button).not.toHaveAttribute("title")
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.mouseEnter(wrapper)
  expect(screen.getByRole("tooltip")).toHaveTextContent("Give me a hint")
  expect(button).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id)
  fireEvent.click(button)
  expect(click).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: "Tab" })
  expect(screen.getByRole("tooltip")).toBeInTheDocument()
  fireEvent.keyDown(document, { key: "Escape" })
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.mouseEnter(wrapper)
  fireEvent.mouseLeave(wrapper)
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  view.rerender(<TutorIconButton icon="hint" label="Give me a hint" onClick={click} />)
  button = screen.getByRole("button")
  fireEvent.focus(button)
  expect(screen.getByRole("tooltip")).toBeInTheDocument()
  fireEvent.blur(button)
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.focus(button)
  fireEvent.scroll(window)
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.focus(button)
  fireEvent.resize(window)
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({ left: 1500, top: 760, bottom: 790 })
  fireEvent.focus(button)
  expect(screen.getByRole("tooltip")).toHaveStyle({ left: "800px", bottom: "14px" })
  view.unmount()
  const dialog = document.createElement("dialog")
  document.body.append(dialog)
  render(<TutorIconButton icon="cancel" label="Close" />, { container: dialog })
  fireEvent.focus(dialog.querySelector("button"))
  expect(dialog.querySelector('[role="tooltip"]')).toHaveTextContent("Close")
  dialog.remove()
})
