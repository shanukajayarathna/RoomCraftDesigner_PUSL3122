import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => console.log('Proxy error:', err))
          proxy.on('proxyReq', (_, req) => console.log('Proxying:', req.method, req.url))
        }
      },
      // Backend file serving (uploaded models + top-view thumbnails)
      '/files': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
