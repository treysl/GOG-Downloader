# GOG Offline Library Downloader

A small web app to browse your GOG library and download offline installers and bonus content to a folder of your choice. You log in with GOG (OAuth), pick games from a grid with thumbnails and checkboxes, and start downloads; the backend streams files from GOG to your configured download path.

## Features

- **Login with GOG** – OAuth flow; no password stored in the app.
- **Library grid** – Owned games with thumbnails, search, and checkboxes.
- **Select all / none** – Quick selection.
- **Download path** – Configured on the server (e.g. Docker volume).
- **Offline installers + bonus** – Optional bonus content (manuals, art, etc.).
- **Progress** – Per-file progress and completed/failed list.

## Quick start with Docker

1. Clone and run with docker-compose:

```bash
cp .env.example .env
# Edit .env if you use your own GOG client id/secret and redirect URI
docker-compose up --build
```

2. Open **http://localhost:8080** in your browser.

3. Click **Login with GOG**, sign in on GOG, and you’ll be redirected back to your library.

4. Select games and click **Download selected**. Files are saved under the `/downloads` volume (see below).

### Docker volume

By default, downloads go to a named volume `gog-downloads`. To use a folder on your host:

```yaml
volumes:
  - /path/on/host/gog-downloads:/downloads
```

## Running without Docker

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export REDIRECT_URI=http://localhost:8080/auth/callback
export FRONTEND_ORIGIN=http://localhost:5173
export DOWNLOAD_PATH=/path/to/downloads   # or e.g. ./downloads
uvicorn main:app --reload --port 8080
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/auth` and `/api` to the backend on port 8080. For login to work, use `REDIRECT_URI=http://localhost:8080/auth/callback` and `FRONTEND_ORIGIN=http://localhost:5173` so the callback lands on the backend and the cookie is set for `localhost` (sent to both 5173 and 8080).

### Production (single server)

Build the frontend and run the backend so it serves the built files:

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8080
```

Then open **http://localhost:8080**.

## OAuth redirect URI

- For the **default/public** GOG client (from the docs), the allowed redirect URI may be fixed (e.g. `https://embed.gog.com/on_login_success?origin=client`). If login fails with “redirect_uri mismatch”, you may need to **register your own client** at GOG and set `GOG_CLIENT_ID`, `GOG_CLIENT_SECRET`, and `REDIRECT_URI` in `.env` to match.
- For **local dev**: `REDIRECT_URI=http://localhost:8080/auth/callback`, `FRONTEND_ORIGIN=http://localhost:5173`.
- For **Docker** (app on 8080): `REDIRECT_URI=http://localhost:8080/auth/callback`, `FRONTEND_ORIGIN=http://localhost:8080`.

## Environment variables

| Variable | Description |
|--------|-------------|
| `GOG_CLIENT_ID` | OAuth client id (default: public client from docs). |
| `GOG_CLIENT_SECRET` | OAuth client secret. |
| `REDIRECT_URI` | Callback URL after GOG login (must match client config). |
| `FRONTEND_ORIGIN` | Origin of the frontend (for redirect and cookie). |
| `DOWNLOAD_PATH` | Base directory for downloads (e.g. `/downloads` in Docker). |

## What gets downloaded

- **Offline installers** – Standalone game installers (e.g. `.exe` / `.sh`) from GOG’s API.
- **Bonus content** – Optional extras (manuals, wallpapers, etc.) when “Include bonus content” is checked.

This app does **not** use the Galaxy CDN (manifest/chunk) pipeline; it only uses the direct HTTP download links provided by `api.gog.com` for offline installers and bonus content.

## License

MIT.
