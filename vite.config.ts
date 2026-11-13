import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Kiri's routes besides "/" — keep in sync with the <Routes> in src/characters/kiri/KiriApp.tsx. */
const SUBPAGES = ['about', 'projects', 'works', 'cited']

/**
 * Every skin's own address, /kara/ and so on — keep in sync with SKIN_IDS in src/SkinContext.tsx.
 * public/ already has folders named after some skins, so GitHub Pages treats /kere as a folder and looks for
 * kere/index.html. /kiri/ is only there to send old or guessed links to "/".
 */
const SKIN_PAGES = ['kiri', 'kuru', 'kere', 'kara']

/**
 * GitHub Pages has no file for /about or /kara/, so it answers with 404.html (status 404), which redirects in JS.
 * Link-preview crawlers don't run JS and see a bare 404. Copying index.html to about.html, kara/index.html etc.
 * makes those URLs real pages with the Open Graph tags, and skips the redirect.
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
      for (const skin of SKIN_PAGES) {
        this.emitFile({ type: 'asset', fileName: `${skin}/index.html`, source: index.source })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), staticSubpages()],
  build: {
    // Kuru's three.js is one big library, so splitting it further wouldn't get under a lower limit.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons-vendor': ['react-icons']
        }
      }
    }
  }
})
