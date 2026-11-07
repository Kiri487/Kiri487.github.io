# Kiri487's Personal Website

My projects, works, and a few other sides of me.

🔗 https://kiri487.github.io/

## Skins

| Skin | Link | What it is |
|---|---|---|
| Kiri | [`/`](https://kiri487.github.io/) | The main site |
| Kuru | [`?skin=kuru`](https://kiri487.github.io/?skin=kuru) | A 3D street at night, with a chill cat |
| Kere | [`?skin=kere`](https://kiri487.github.io/?skin=kere) | A LaTeX-style CV, with a very professional assistant |
| Kara | [`?skin=kara`](https://kiri487.github.io/?skin=kara) | An old desktop computer that belongs to someone strange, with games |
| Koro | — | Coming soon |

Kiri is the hub: the switcher in the bottom-right corner opens the others, and each of them has a way back. The
last skin you used is remembered, but a `?skin=` link always wins.

## Tech Stack

- **Framework:** React 19 + TypeScript, built with Vite
- **Kiri:** React Router
- **Kuru:** three.js through React Three Fiber, Drei and postprocessing
- **Kere, Kara:** no extra libraries
- **Icons:** react-icons; Kara uses the Tango icon theme and Fluent Emoji

## Development

```bash
npm ci           # install dependencies
npm run dev      # start the dev server
npm run lint     # run ESLint
npm run build    # type-check and build for production
npm run preview  # preview the production build
```

## Deployment

GitHub Actions lints and builds every pull request. A push to `main` also deploys the build to GitHub Pages.
