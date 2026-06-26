import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // jsdom for component tests — node for pure utility/unit tests (overridable per file)
    environment: 'jsdom',
    globals: true,

    // Setup file runs before every test file — initializes MSW server + jest-dom matchers
    setupFiles: ['./src/test/setupTests.ts'],

    // Coverage thresholds enforced in CI and local runs
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/router.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },

    // Include patterns for test discovery
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
