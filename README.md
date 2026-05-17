# Authorization Model Site

This repository renders `authorization-model.md` as a static HTML page using Astro and deploys it to GitHub Pages with GitHub Actions.

## How It Works

- `authorization-model.md` is the source-of-truth spec file.
- `src/pages/index.astro` reads that file and converts markdown to HTML at build time.
- `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages when you push to `main`.

## Local Development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build production output: `npm run build`
- Preview build locally: `npm run preview`

## Publishing on GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In GitHub, open **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a commit to `main` (or run the workflow manually from the Actions tab).
5. After deploy finishes, your site will be available at:
   - `https://<github-username>.github.io/<repository-name>/`

## Updating the Spec

1. Edit `authorization-model.md`.
2. Commit and push your changes.
3. GitHub Actions rebuilds and republishes the site automatically.
