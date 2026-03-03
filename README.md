# GOG Offline Library Downloader

A self-hosted web app to browse your GOG game library and download offline installers and bonus content. Log in with your GOG account, pick games from a visual grid, choose a download path, and start downloading -- the backend streams files directly from GOG's servers to your local storage.

## Features

- **Manual GOG login** -- Open the GOG login page, copy the redirect URL, and paste it back (no developer API key needed).
- **One-click paste** -- "Paste URL & Login" button reads your clipboard and logs you in automatically.
- **Library grid** -- Owned games displayed with cover art, search, and checkboxes.
- **Select all / Deselect all** -- Quick bulk selection.
- **Editable download path** -- Change the destination folder directly from the web UI.
- **Offline installers + bonus** -- Optionally include bonus content (manuals, soundtracks, art, etc.).
- **Download progress** -- Per-file progress bar with completed/failed tracking.
- **GOG-inspired design** -- Dark theme with purple accents matching GOG's visual style.
- **Accessible** -- Keyboard navigation, screen reader support, WCAG AA color contrast.

## Quick start with Docker

1. Clone and run:

```bash
cp .env.example .env
docker-compose up --build
```

2. Open **http://localhost:8080** in your browser.

3. Click **Open GOG login** -- a new tab opens with the GOG sign-in page.

4. Log in with your GOG credentials. You'll land on a blank page. Copy the URL from the address bar (`Cmd+L`, `Cmd+C` on Mac or `Ctrl+L`, `Ctrl+C` on Windows/Linux).

5. Switch back to **http://localhost:8080** and click **Paste URL & Login**.

6. Select games from the grid and click **Download**. Files are saved to the `./downloads` folder in the project directory.

### Download location

By default, downloads are saved to `./downloads/` in the project directory (bind-mounted into the container). To change the host path, edit `docker-compose.yml`:

```yaml
volumes:
  - /your/custom/path:/downloads
```

You can also change the path within the container from the web UI using the download path field in the toolbar.

## Running without Docker

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export FRONTEND_ORIGIN=http://localhost:5173
export DOWNLOAD_PATH=./downloads
uvicorn main:app --reload --port 8080
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/auth` and `/api` to the backend on port 8080.

### Production (single server)

Build the frontend and serve it from the backend:

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8080
```

Then open **http://localhost:8080**.

## How login works

This app uses GOG's public OAuth client (no developer API key required). Since the public client only allows redirects to `https://embed.gog.com/on_login_success`, a manual paste flow is used:

1. The app opens the GOG login page in a new tab.
2. After you log in, GOG redirects to a blank page with a `code` parameter in the URL.
3. You copy that URL and paste it back into the app.
4. The backend exchanges the code for an access token and stores it in-memory for your session.

Your GOG credentials are sent directly to GOG's servers. The app only receives the authorization code and access token.

## Environment variables

| Variable | Description |
|--------|-------------|
| `GOG_CLIENT_ID` | OAuth client ID (default: public GOG client). |
| `GOG_CLIENT_SECRET` | OAuth client secret (default: public GOG client). |
| `REDIRECT_URI` | OAuth callback URL (default: `http://localhost:8080/auth/callback`). |
| `FRONTEND_ORIGIN` | Origin of the frontend for cookies (default: `http://localhost:8080`). |
| `DOWNLOAD_PATH` | Base directory for downloads inside the container (default: `/downloads`). |

## What gets downloaded

- **Offline installers** -- Standalone game installers (`.exe` / `.sh` / `.bin`) from GOG's download API.
- **Bonus content** -- Optional extras (manuals, wallpapers, soundtracks) when "Include bonus content" is checked.

This app uses the direct HTTP download links from `api.gog.com` for offline installers and bonus content. It does not use the Galaxy CDN manifest/chunk pipeline.

## License

MIT.
