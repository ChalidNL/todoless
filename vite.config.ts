import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { version } from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgr()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_ENV': JSON.stringify(process.env.VITE_ENV || process.env.NODE_ENV || 'prod'),
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5174,
    strictPort: false, // Auto-retry with next available port if 5174 is in use
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
});
