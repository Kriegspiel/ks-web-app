import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"

const dist = path.resolve("dist")
const manifest = JSON.parse(fs.readFileSync(path.join(dist, ".vite/manifest.json"), "utf8"))
const initial = new Set()
function visit(key) {
  if (initial.has(key)) return
  initial.add(key)
  for (const dependency of manifest[key].imports ?? []) visit(dependency)
}
visit("index.html")
const initialBytes = [...initial].reduce((total, key) => (
  total + gzipSync(fs.readFileSync(path.join(dist, manifest[key].file))).length
), 0)
// Full route delivery avoids a network/React boundary during the game journey.
assert.ok(initialBytes < 230000, `Initial JavaScript exceeds 230,000 gzip bytes: ${initialBytes}`)
// Defer only the optional Tutor message formatter, never a route/view.
const deferred = Object.entries(manifest).filter(([, entry]) => entry.isDynamicEntry).map(([key]) => key)
assert.deepEqual(deferred, ["node_modules/react-markdown/index.js"],
  "Only the Tutor Markdown formatter may be deferred; route views must remain available at entry")
console.log(`Build checks passed: ${initialBytes.toLocaleString()} initial gzip JS bytes; routes are available at entry.`)
