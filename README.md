# LuauCraft Studio

Interactive zero-to-pro Roblox Studio Luau coding platform running the real Roblox Luau compiler & VM in WebAssembly (`luau-web`), paired with a live Three.js 3D Viewport, Explorer tree, Output/Network/DataStore console, and 32 hands-on lessons + 4 Free-Build Sandbox templates.

## Run Locally

```bash
npm install
npm run dev
```

Build the static bundle (`dist/`):

```bash
npm run build
```

## Publish as a GitHub Pages Site

This repository is preconfigured for GitHub Pages (relative asset paths in `vite.config.ts`, `public/.nojekyll`, and `.github/workflows/deploy.yml`).

1. Create a new repository on GitHub and push this code to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. On GitHub, open **Settings -> Pages**, set **Source** to **GitHub Actions**.
3. Wait ~1 minute for the **Deploy LuauCraft Studio to GitHub Pages** workflow to finish—your live URL will appear at `https://<your-username>.github.io/<your-repo>/`.

> **Note on Google Sign-In:** Guest progress and sandbox scripts save automatically in `localStorage`. If you want Google Sign-In & Firestore cloud sync enabled on your `*.github.io` URL, add `<your-username>.github.io` under **Firebase Console -> Authentication -> Settings -> Authorized domains**.
