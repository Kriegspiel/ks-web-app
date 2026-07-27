import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server.mjs', 'src/**/*.{js,jsx}'],
      exclude: [
        'coverage/**',
        'dist/**',
        'eslint.config.js',
        'src/__tests__/**',
        'src/main.jsx',
        'src/pages/RulesPage.jsx',
        'vite.config.js',
        'vitest.config.js',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
}))
