## GOG Offline Library Downloader

**Self-hosted web app to browse your GOG library and download offline installers and bonus content to a local folder.**

### What it does

- **Shows your GOG games** in a simple grid.
- **Lets you pick games and extras** to download.
- **Saves files to a folder you control** on your machine.

### How to start (Docker)

```bash
cp .env.example .env
docker-compose up --build
```

Then open **http://localhost:8080** in your browser, log in to GOG (see below), select games, and click **Download**.

### How to log in to GOG

1. In your browser, open **http://localhost:8080** and wait for the login screen.
2. Click **Open GOG login**. A new tab to `auth.gog.com` will open.
3. Sign in with your GOG account as usual.  
4. After login you will land on a mostly blank `embed.gog.com` page. Copy the **entire URL** from the address bar (for example with <kbd>Ctrl+L</kbd> then <kbd>Ctrl+C</kbd> / <kbd>Cmd+L</kbd> then <kbd>Cmd+C</kbd>).
5. Go back to the downloader tab:
   - Either click **Paste URL & Login** to let the app read the URL from your clipboard, or  
   - Paste the URL into the text box and click **Submit**.
6. When login succeeds, the page will switch to your library view. You can now search, select games, and start downloads. Use **Sign out** in the top-right corner when you’re done.

### Where downloads are saved

- **Default location (current setup)**  
  Downloads are stored in a Docker named volume mounted at `/downloads` inside the container.

- **Change destination on the host**  
  Edit `docker-compose.yml` to mount a host folder instead of the named volume:

  ```yaml
  services:
    app:
      # ...
      volumes:
        - C:/path/on/your/pc:/downloads
  ```

- **Change folder inside the app**  
  In the web UI, use the **Download path** field in the toolbar to choose a different subfolder under `/downloads` (or your mapped host folder).
