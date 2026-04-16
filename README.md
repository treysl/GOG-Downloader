## GOG Offline Library Downloader

**Portable Windows app to browse your GOG library and download offline installers and bonus content to any folder you choose.**

### What it does

- Shows your GOG games in a grid.
- Lets you pick games and extras to download.
- Saves files to a folder you control — change it live from the UI.
- Runs entirely on your machine; nothing is uploaded anywhere.

---

### Quick start

1. Download and unzip `GOG-Downloader.zip`.
2. Double-click **`GOG-Downloader.exe`**.
3. A purple **G** icon appears in the system tray (bottom-right of the taskbar). Your browser opens automatically to `http://localhost:8080`.
4. Log in to GOG (see below), select games, and click **Download**.

To quit the app, right-click the tray icon and choose **Exit**.  
To reopen the browser at any time, double-click the tray icon or choose **Open Browser**.

---

### How to log in to GOG

1. On the login screen, click **Open GOG login**. A new tab to `auth.gog.com` opens.
2. Sign in with your GOG account.
3. After login you land on a mostly blank `embed.gog.com` page. Copy the **entire URL** from the address bar (<kbd>Ctrl+L</kbd> then <kbd>Ctrl+C</kbd>).
4. Go back to the downloader tab:
   - Click **Paste URL & Login** to let the app read the URL from your clipboard, or
   - Paste the URL into the text box and click **Submit**.
5. The page switches to your library. Search, select games, and start downloads. Use **Sign out** in the top-right corner when you are done.

---

### Changing the download folder

The **Save to** field in the download options bar shows the current download location. Type any absolute path (e.g. `D:\Games\GOG`) and click **Save** (or press <kbd>Enter</kbd>). The folder is created automatically if it does not exist. The setting persists across restarts.

Default location: `%USERPROFILE%\Downloads\GOG`

---

### Building from source

Requirements: **Node.js 20+**, **Python 3.11+**, and **pip** on your `PATH`.

```powershell
git clone https://github.com/yourname/GOG-Downloader.git
cd GOG-Downloader
.\build.ps1
```

The script:
1. Runs `npm install && npm run build` inside `frontend/`.
2. Runs `pip install -r requirements.txt`.
3. Packages everything with PyInstaller.

Output is in `dist\GOG-Downloader\`. Zip that folder to share.

---

### Running in development (no build required)

**Backend:**
```powershell
cd backend
pip install -r ..\requirements.txt
$env:DOWNLOAD_PATH = "$env:USERPROFILE\Downloads\GOG"
uvicorn main:app --host 127.0.0.1 --port 8080 --reload
```

**Frontend** (in a second terminal):
```powershell
cd frontend
npm install
npm run dev   # Vite dev server on http://localhost:5173 with proxy to :8080
```

---

### Docker (legacy)

Docker is no longer the primary distribution method but the configuration is still present if needed.

```bash
cp .env.example .env
cd docker
docker compose up --build
```

Downloads are written to a Docker-managed volume by default (or override with a volume mapping in `docker/docker-compose.yml`).
