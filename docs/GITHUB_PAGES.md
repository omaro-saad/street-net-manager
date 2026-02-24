# Publishing to GitHub Pages

The app is set up to build and deploy to **GitHub Pages** via GitHub Actions.

## Live URL

After you enable Pages, the site will be at:

**https://omaro-saad.github.io/street-net-manager/**

## One-time setup

1. **Enable GitHub Pages**
   - Open your repo: [github.com/omaro-saad/street-net-manager](https://github.com/omaro-saad/street-net-manager)
   - Go to **Settings** → **Pages**
   - Under **Build and deployment**:
     - **Source**: choose **GitHub Actions**

2. **Deploy**
   - Every push to the `main` branch runs the workflow and deploys the latest build.
   - You can also run it manually: **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

## What the workflow does

- Runs on every push to `main` (and on manual trigger).
- Installs dependencies and runs `npm run build` with `VITE_BASE_PATH=/street-net-manager/` so assets load correctly under the project path.
- Uploads the `dist/` output to GitHub Pages.

## Optional: use your own API

The web app can talk to your backend when `VITE_API_URL` is set at build time. For the GitHub Actions build you can add a repository secret and pass it as an env var:

1. In the repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret** (e.g. `VITE_API_URL` = `https://your-api.com`).
2. In `.github/workflows/deploy-pages.yml`, in the **Build for GitHub Pages** step, add:
   ```yaml
   env:
     VITE_BASE_PATH: /street-net-manager/
     VITE_API_URL: ${{ secrets.VITE_API_URL }}
   ```
3. Then the built site will call your API for login and data.

If you don’t set `VITE_API_URL`, the built site will have no API URL; users will see the login screen and a message that the server is required (or similar, depending on your `AuthContext` / API mode logic).

## Local build for Pages (optional)

To test the same build locally:

```bash
VITE_BASE_PATH=/street-net-manager/ npm run build
npx serve dist
```

Then open the URL that `serve` prints (e.g. http://localhost:3000/street-net-manager/).
