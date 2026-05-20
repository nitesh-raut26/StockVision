import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts')) return 'charts';
          if (id.includes('framer-motion')) return 'animation';
          if (id.includes('@tanstack/react-query') || id.includes('zustand')) return 'query';
          if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
        },
      },
    },
    // Warn when any chunk exceeds 500KB (Vite default is 2MB — too permissive)
    chunkSizeWarningLimit: 500,
  },
})
