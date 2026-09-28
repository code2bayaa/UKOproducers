import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// UKO producers — rights holders' web-app, single-page app (no SSR) on http://localhost:3018
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact(), tailwindcss()],
  server: { port: 3018 },
})
