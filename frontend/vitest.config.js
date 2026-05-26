import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { contentRoot } from './contentRoot.config.js'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kriegspiel-content': contentRoot,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'eslint.config.js',
        'src/main.jsx',
        'src/pages/RulesPage.jsx',
        'vite.config.js',
        'vitest.config.js',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
