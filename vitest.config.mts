import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Scoped deliberately to the pure modules: lib/reading/* and lib/games/*.
 *
 * Those modules are pure — no React, no DOM, they take plain rect objects or
 * plain strings rather than elements — which is exactly what makes this a
 * node-environment runner with no jsdom, no setup file, and no
 * component-testing dependencies. Keep it that way: if one of them starts
 * needing the DOM, that is a sign the logic has leaked into a component.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/reading/*.test.ts', 'lib/games/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
