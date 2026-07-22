import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The Dimidium MCP server (npm run mcp) answers /api/public/mcp in dev.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
