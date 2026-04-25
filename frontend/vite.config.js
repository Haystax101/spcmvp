// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// frontend/vite.config.js
export default defineConfig({
  base: "/platform-beta/",
  plugins: [
    tailwindcss(),
    react()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. Separate the heavy UI libraries
            if (id.includes('recharts')) return 'recharts-ui';
            if (id.includes('framer-motion')) return 'animations';
            if (id.includes('appwrite')) return 'appwrite-sdk';
            if (id.includes('sentry')) return 'sentry-logs';

            // 2. Everything else goes into a general vendor chunk
            return 'vendor';
          }
        }
      }
    }
  }
})

