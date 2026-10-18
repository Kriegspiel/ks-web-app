// @vitest-environment node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { build } from "vite"
import viteConfig from "../../vite.config.js"
import { createServer } from "../../server.mjs"

it("keeps previous route chunks available to tabs open during a deployment", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-route-retention-"))
  let server
  try {
    fs.writeFileSync(path.join(root, "index.html"), '<script type="module" src="/main.js"></script>')
    fs.writeFileSync(path.join(root, "main.js"), 'window.openScreen = () => import("./screen.js")')
    fs.writeFileSync(path.join(root, "screen.js"), 'document.body.textContent = "old-screen"')
    const config = { ...viteConfig, configFile: false, root, logLevel: "silent", build: { ...viteConfig.build, outDir: path.join(root, "dist") } }
    await build(config)
    const oldManifest = JSON.parse(fs.readFileSync(path.join(root, "dist/.vite/manifest.json"), "utf8"))
    const oldChunk = oldManifest["screen.js"].file
    const oldBody = fs.readFileSync(path.join(root, "dist", oldChunk), "utf8")
    fs.writeFileSync(path.join(root, "screen.js"), 'document.body.textContent = "new-screen"')
    await build(config)
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "dist/.vite/manifest.json"), "utf8"))
    expect(manifest["screen.js"].file).not.toBe(oldChunk)
    expect(fs.readFileSync(path.join(root, "dist", oldChunk), "utf8")).toBe(oldBody)
    server = createServer({ distRoot: path.join(root, "dist") })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    const response = await fetch(`http://127.0.0.1:${server.address().port}/${oldChunk}`, { headers: { "x-forwarded-proto": "https" } })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8")
    expect(await response.text()).toBe(oldBody)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
})
