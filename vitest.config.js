/**
 * PlexifyAEC — Vitest Configuration
 *
 * Server-side test config. Runs ESM, no browser dependencies.
 * Uses the 'node' environment to avoid DOM/browser APIs.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.js'],
    globals: true,
  },
});
