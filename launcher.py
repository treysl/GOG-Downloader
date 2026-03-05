"""
GOG Downloader — Windows portable launcher.

Starts the FastAPI/uvicorn server in a background thread and creates a
system-tray icon so users can open the browser or quit the app.
"""
import os
import sys
import threading
import time
import webbrowser


# ── Path helpers ──────────────────────────────────────────────────────────────

def _base_dir() -> str:
    """Return the directory that contains backend/ and frontend/."""
    if getattr(sys, "frozen", False):
        # PyInstaller extracts data files here at runtime
        return sys._MEIPASS  # type: ignore[attr-defined]
    return os.path.dirname(os.path.abspath(__file__))


# ── Environment defaults (must be set before any backend imports) ─────────────

_base = _base_dir()

os.environ.setdefault("GOG_CLIENT_ID", "46899977096215655")
os.environ.setdefault(
    "GOG_CLIENT_SECRET",
    "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9",
)
os.environ.setdefault("REDIRECT_URI", "http://localhost:8080/auth/callback")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:8080")

_default_dl = os.path.join(os.path.expanduser("~"), "Downloads", "GOG")
os.environ.setdefault("DOWNLOAD_PATH", _default_dl)

# Make backend modules importable
sys.path.insert(0, os.path.join(_base, "backend"))


# ── Server ────────────────────────────────────────────────────────────────────

PORT = 8080
URL = f"http://localhost:{PORT}"


def _start_server() -> None:
    import uvicorn
    from main import app  # noqa: F401 – imported for side-effects (route registration)

    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


# ── Tray icon ─────────────────────────────────────────────────────────────────

def _make_icon_image():
    from PIL import Image, ImageDraw, ImageFont

    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # GOG-purple circle
    draw.ellipse([2, 2, size - 2, size - 2], fill=(126, 77, 210, 255))
    # "G" label — use default font (no external font file needed)
    try:
        font = ImageFont.truetype("arial.ttf", 32)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "G", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]),
        "G",
        fill=(255, 255, 255, 255),
        font=font,
    )
    return img


def _open_browser(icon=None, item=None) -> None:  # noqa: ARG001
    webbrowser.open(URL)


def _exit_app(icon, item=None) -> None:  # noqa: ARG001
    icon.stop()
    os._exit(0)


def _run_tray() -> None:
    import pystray

    icon_img = _make_icon_image()
    menu = pystray.Menu(
        pystray.MenuItem("Open Browser", _open_browser, default=True),
        pystray.MenuItem("Exit", _exit_app),
    )
    tray = pystray.Icon(
        "GOG Downloader",
        icon_img,
        f"GOG Downloader  —  {URL}",
        menu,
    )
    tray.run()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Start uvicorn in a background daemon thread
    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    # Open the browser shortly after the server has had time to start
    def _delayed_open() -> None:
        time.sleep(1.5)
        _open_browser()

    threading.Thread(target=_delayed_open, daemon=True).start()

    # Block on the tray icon (runs the Win32 message loop)
    _run_tray()
