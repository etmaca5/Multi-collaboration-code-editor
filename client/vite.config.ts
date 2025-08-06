
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:5000',
      '/collab': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  }
})
