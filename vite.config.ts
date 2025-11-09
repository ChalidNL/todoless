import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    // Let Rollup decide chunking to avoid evaluation-order issues with some libraries
    // (react-big-calendar + prop-types caused a TDZ error when force-split into a custom chunk)
    // If you want vendor splitting later, re-introduce manualChunks cautiously without touching react-big-calendar
  },
})
