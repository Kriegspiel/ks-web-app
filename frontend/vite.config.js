import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contentRoot } from './contentRoot.config.js'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kriegspiel-content': contentRoot,
    },
  },
  server: {
    allowedHosts: ['app.kriegspiel.org'],
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['app.kriegspiel.org'],
  },
})
