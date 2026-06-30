import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" path alias so tests import the same modules.
    alias: { '@': resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // A signing secret so lib/access.ts can mint/verify tokens under NODE_ENV=test
    // (it fails closed when unset outside development — which is the point).
    env: { ACCESS_TOKEN_SECRET: '0123456789abcdef0123456789abcdef' },
  },
})
