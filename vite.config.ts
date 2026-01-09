import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
build: {
    chunkSizeWarningLimit: 500, 
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
          'mui-vendor': ['@mui/material', '@mui/lab', '@emotion/react', '@emotion/styled'],
          'p5-vendor': ['p5'],
          'icons-vendor': ['react-icons']
        }
      }
    }
  }
})
