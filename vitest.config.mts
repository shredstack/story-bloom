import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Scoped deliberately to lib/reading/*.test.ts.
 *
 * Those modules are pure — no React, no DOM, they take plain rect objects
 * rather than elements — which is exactly what makes this a node-environment
 * runner with no jsdom, no setup file, and no component-testing dependencies.
 * Keep it that way: if a reading module starts needing the DOM, that is a sign
 * the logic has leaked into a component.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/reading/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
