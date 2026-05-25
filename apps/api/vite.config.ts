import { defineConfig } from 'vite'
import build from '@hono/vite-build/vercel'

export default defineConfig({
  plugins: [
    build({
      entry: './src/index.ts',
      vercel: {
        name: 'api',
        routes: [{ src: '^/(?:api(?:/.*)?)?$' }]
      }
    })
  ]
})
