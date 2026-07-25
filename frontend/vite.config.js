import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

const workspaceDirectory = searchForWorkspaceRoot(process.cwd())
const sharedFooterDirectory = path.resolve(process.cwd(), '../../ks-content/site/footer')
const sharedFooterRealDirectory = fs.realpathSync(sharedFooterDirectory)

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['app.kriegspiel.org'],
    fs: {
      allow: [workspaceDirectory, sharedFooterDirectory, sharedFooterRealDirectory],
    },
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['app.kriegspiel.org'],
  },
})
