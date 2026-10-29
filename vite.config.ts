import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Kiri's routes besides "/" — keep in sync with the <Routes> in src/characters/kiri/KiriApp.tsx. */
const SUBPAGES = ['about', 'projects', 'works', 'cited']

/**
 * GitHub Pages has no file for /about etc., so it answers with 404.html (status 404), which redirects in JS.
 * Link-preview crawlers don't run JS and see a bare 404. Copying index.html to about.html etc. makes those
 * URLs real pages (GitHub Pages serves /about from about.html) with the Open Graph tags, and skips the redirect.
 */
function staticSubpages(): Plugin {
  return {
    name: 'static-subpages',
    apply: 'build',
    // After Vite has written the final index.html into the bundle.
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (index?.type !== 'asset') throw new Error('static-subpages: index.html not found in the bundle')
      for (const page of SUBPAGES) {
        this.emitFile({ type: 'asset', fileName: `${page}.html`, source: index.source })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), staticSubpages()],
build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/lab', '@emotion/react', '@emotion/styled'],
          'p5-vendor': ['p5'],
          'icons-vendor': ['react-icons']
        }
      }
    }
  }
})
