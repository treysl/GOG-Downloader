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

Then open **http://localhost:8080** in your browser, log in to GOG using the buttons in the UI, select games, and click **Download**.

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
