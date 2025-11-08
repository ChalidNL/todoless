import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5174,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-big-calendar') || id.includes('date-fns')) return 'calendar'
            if (id.includes('@dnd-kit')) return 'dnd'
            if (id.includes('dexie')) return 'dexie'
            if (id.includes('framer-motion')) return 'framer'
            if (id.includes('react-router')) return 'router'
            if (id.includes('react-dom') || id.includes('react/jsx-runtime') || id.includes('react')) return 'react'
            return 'vendor'
          }
        },
      },
    },
  },
})
