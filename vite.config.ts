import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const SITE = 'https://kiri487.github.io'

/** Kiri's routes besides "/" — keep in sync with the <Routes> in src/characters/kiri/KiriApp.tsx. */
const SUBPAGES = ['about', 'projects', 'works', 'cited']

/**
 * Every skin's own address, /kara/ and so on — keep in sync with SKIN_IDS in src/SkinContext.tsx.
 * public/ already has folders named after some skins, so GitHub Pages treats /kere as a folder and looks for
 * kere/index.html. /kiri/ is only there to send old or guessed links to "/".
 */
const SKIN_PAGES = ['kiri', 'kuru', 'kere', 'kara']

interface Page {
  fileName: string
  /** The address it is shared under, which its canonical link and og:url name. */
  path: string
}

const PAGES: Page[] = [
  ...SUBPAGES.map((page) => ({ fileName: `${page}.html`, path: `/${page}` })),
  ...SKIN_PAGES.map((skin) => ({ fileName: `${skin}/index.html`, path: skin === 'kiri' ? '/' : `/${skin}/` })),
]

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Replaces one tag's value, and fails the build if index.html no longer has that tag. */
function setValue(html: string, pattern: RegExp, value: string): string {
  if (!pattern.test(html)) throw new Error(`static-subpages: index.html has no match for ${pattern}`)
  return html.replace(pattern, (_, before: string, after: string) => `${before}${escapeHtml(value)}${after}`)
}

function pageHtml(index: string, { path }: Page): string {
  let html = index
  html = setValue(html, /(<link rel="canonical" href=")[^"]*(")/, `${SITE}${path}`)
  html = setValue(html, /(<meta property="og:url" content=")[^"]*(")/, `${SITE}${path}`)
  return html
}

/**
 * GitHub Pages has no file for /about or /kara/, so it answers with 404.html (status 404), which redirects in JS.
 * Link-preview crawlers don't run JS and see a bare 404. Copying index.html to about.html, kara/index.html etc.
 * makes those URLs real pages with the Open Graph tags, and skips the redirect. Each copy names its own address.
 */
function staticSubpages(): Plugin {
  return {
    name: 'static-subpages',
    apply: 'build',
    // After Vite has written the final index.html into the bundle.
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (index?.type !== 'asset' || typeof index.source !== 'string') {
        throw new Error('static-subpages: index.html not found in the bundle')
      }
      for (const page of PAGES) {
        this.emitFile({ type: 'asset', fileName: page.fileName, source: pageHtml(index.source, page) })
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
