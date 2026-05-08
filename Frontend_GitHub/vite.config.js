import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/llamaparse': {
        target: 'https://api.cloud.llamaindex.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llamaparse/, '/api/parsing')
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
