# Security

This document describes how the app is secured against theft, scripting, and abuse.

## Server (API)

- **Authentication**: JWT with short expiry (7 days). Set a strong `JWT_SECRET` in production (see `server/.env.example`). The app refuses to start if `NODE_ENV=production` and `JWT_SECRET` is still the default.
- **Rate limiting**:
  - Login: **10 attempts per 15 minutes per IP** to slow brute-force and scripts.
  - General API: **300 requests per 15 minutes per IP** to limit abuse.
- **Security headers** (Helmet): `X-Frame-Options: deny`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS. Reduces clickjacking and some XSS.
- **CORS**: Configure `CORS_ALLOWED_ORIGINS` in production so only your front-end origins can call the API. Empty = same-origin only.
- **Input limits**: Login body size capped (4kb); username/password length limited to prevent DoS.
- **No secrets in responses**: Passwords and internal IDs are never returned; errors are generic where appropriate.

## Frontend (Vite build)

- **No source maps in production**: Built bundle is minified and not easily readable.
- **Console/debugger stripped**: Production build drops `console.*` and `debugger` to avoid leaking info and to reduce scriptability.
- **Hashed asset names**: Scripts and assets use content hashes so caching is safe and names don’t reveal structure.
- **API URL**: Comes from build-time env (`VITE_API_URL`). Don’t put secrets in front-end env.

## Electron (packaged app)

- **Context isolation & no Node in renderer**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` so the renderer cannot access Node or the system directly.
- **Preload**: Only a small, explicit API is exposed via `contextBridge`; no raw `require` or `process`.
- **DevTools disabled**: F12 and Ctrl+Shift+I are blocked in production to make inspection and scripting harder.
- **Navigation locked**: New windows and top-level navigation are blocked; links open in the system browser.
- **CSP**: Content-Security-Policy allows only `self` and required API origins (e.g. `https:`, `localhost`) for `connect-src` so the app can call your API when loaded from `file://`.
- **Single instance**: Only one app instance runs; no duplicate windows from scripting.

## Token storage

- **Browser / dev**: Auth token is stored in `localStorage` under a fixed key. Clear on logout. Use HTTPS in production so traffic is encrypted.
- **Electron**: Same key is used. For stronger protection on the desktop, consider moving token storage to the main process with Electron `safeStorage` (OS keychain) and exposing get/set via preload; that would require a small refactor of `AuthContext`.

## Recommendations

1. **Production**: Set `NODE_ENV=production`, a strong `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` for your front-end.
2. **HTTPS**: Serve the API and front-end over HTTPS in production.
3. **Secrets**: Never commit `.env` or real keys. Use `server/.env.example` as a template.
4. **Updates**: Keep dependencies (Express, Electron, Vite, React) updated for security fixes.
5. **Backups**: Backups and exports contain app data; store them in a safe place and restrict access.

## Reporting issues

If you find a security issue, report it privately to the maintainers rather than opening a public issue.
