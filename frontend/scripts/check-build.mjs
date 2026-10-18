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
assert.ok(initialBytes < 170000, `Initial JavaScript exceeds 170,000 gzip bytes: ${initialBytes}`)
for (const name of ["LobbyPage", "GamePage", "Review", "TutorReview", "Profile", "GameHistory", "Leaderboard", "AcquisitionReport", "BotMatrixReport", "BotsReport", "GuestsReport", "TechIndex", "UsersReport", "Settings", "Subscription"]) {
  const key = `src/pages/${name}.jsx`
  assert.ok(manifest[key]?.isDynamicEntry, `${name} must remain a separate route chunk`)
  assert.ok(!initial.has(key), `${name} must not be required by the initial entry`)
}
console.log(`Build checks passed: ${initialBytes.toLocaleString()} initial gzip JS bytes; heavy routes load on demand.`)
