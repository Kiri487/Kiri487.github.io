# Kiri487.github.io

Kiri's personal site: one portfolio shown by several "skins", each a cat with its own look. React 19 + TypeScript,
built with Vite, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Layout

```
src/
  App.tsx              lazy-loads the active skin
  SkinContext.tsx      the active skin, kept in ?skin= and localStorage
  SkinSwitcher.tsx     the badges on Kiri's page that open the other skins
  data/portfolio/      the shared content: about, projects, works, contacts
  config/assets.tsx    Kiri's home videos, their posters and music
  shared/              only what every skin can use (see below)
  characters/<skin>/   everything else, one folder per skin
public/<skin>/         large media and fonts, served as-is
```

Skins: `kiri` (the main site), `kuru` (3D street, React Three Fiber), `kere` (LaTeX-style CV with an assistant),
`kara` (an old desktop computer with games). `koro` is planned.

## Rules

- **Each skin keeps to its folder.** Its CSS is scoped under `[data-skin="<skin>"]`. Components that show the
  shared content stay in their skin, even when two look alike: every skin is meant to look different.
- **Content lives in `src/data/portfolio/`**, never in a skin.
- **Use the shared helpers:**
  - `shared/storage.ts` for every localStorage or sessionStorage read and write. Storage can be blocked.
  - `shared/audio.ts` for the one AudioContext the whole site shares. Never create another.
  - `shared/math.ts` for `clamp`.
  - `shared/motion.ts` for `prefersReducedMotion()`. Anything that moves on its own should stay still when it's true.
- **No new dependencies without asking.** Kere and Kara are built by hand on React and react-icons; Kara's window
  system, games and sounds included.
- React Hooks lint is strict: keep `Math.random()` and `Date.now()` out of render, and don't set state
  synchronously inside an effect (use an event, a timer or `requestAnimationFrame`).

## Adding assets

- **Project image:** a WebP in `public/kiri/img/`, plus a 64 px thumbnail with the same name in
  `public/kiri/img/thumbs/` for Kara's program list:
  `ffmpeg -i X.png -vf "scale=64:64:force_original_aspect_ratio=increase,crop=64:64" -c:v libwebp -quality 80 thumbs/X.webp`
- **Home video:** a `.webm` (VP9 with alpha), an `_iOS.mov` (HEVC with alpha) and a poster of the first frame,
  listed in `src/config/assets.tsx`. The poster needs the VP9 decoder named, or the transparency is lost:
  `ffmpeg -c:v libvpx-vp9 -i X.webm -frames:v 1 -c:v libwebp -quality 85 posters/X.webp`
- **Fonts** are self-hosted next to their OFL licence, in the skin's own `public/<skin>/fonts/`.
- Kiri's routes are mirrored in `SUBPAGES` in `vite.config.ts`, so GitHub Pages serves them with a 200.

## Commands

```bash
npm ci           # install
npm run dev      # dev server at http://localhost:5173 (?skin=kara etc.)
npm run lint
npm run build    # type-check and build
```

Every pull request runs lint and build in CI. Only `main` deploys.
