import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so tests don't spin up the Cloudflare/PWA plugins.
export default defineConfig({
  test: {
    include: ['{src,shared,worker}/**/*.test.ts'],
  },
})
