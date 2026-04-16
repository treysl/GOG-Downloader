"""
GOG Downloader — Windows portable launcher.

Starts the FastAPI/uvicorn server in a background thread and creates a
system-tray icon so users can open the browser or quit the app.
"""
import os
import sys
import threading
import time
import traceback
import webbrowser


# ── Logging / stdout fix for windowed exe ────────────────────────────────────
# PyInstaller windowed apps have sys.stdout = None, which breaks uvicorn's log
# formatter (.isatty() call). Redirect both streams to a log file so the
# server can start and errors are still inspectable.

_LOG_DIR = os.path.join(os.path.expanduser("~"), ".gog-downloader")
_LOG_FILE = os.path.join(_LOG_DIR, "launcher.log")

if getattr(sys, "frozen", False):
    os.makedirs(_LOG_DIR, exist_ok=True)
    _log_io = open(_LOG_FILE, "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = _log_io
    if sys.stderr is None:
        sys.stderr = _log_io


def _log(msg: str) -> None:
    try:
        import datetime
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


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

# When running as source, make the backend package importable.
# When frozen by PyInstaller the backend modules are compiled into the bundle
# at the top level, so no extra path manipulation is needed.
if not getattr(sys, "frozen", False):
    sys.path.insert(0, os.path.join(_base, "backend"))


# ── Server ────────────────────────────────────────────────────────────────────

PORT = 8080
URL = f"http://localhost:{PORT}"


def _start_server() -> None:
    try:
        _log("Importing uvicorn and FastAPI app...")
        import uvicorn
        from main import app  # noqa: F401

        _log("Starting uvicorn on 127.0.0.1:8080")
        uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
    except Exception:
        _log("SERVER CRASHED:\n" + traceback.format_exc())
        raise


# ── Tray icon ─────────────────────────────────────────────────────────────────

def _make_icon_image():
    from PIL import Image, ImageDraw

    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Modern, simple mark: rounded square + download arrow.
    draw.rounded_rectangle([4, 4, size - 4, size - 4], radius=15, fill=(84, 54, 180, 255))
    draw.rounded_rectangle([13, 13, size - 13, size - 13], radius=10, fill=(108, 72, 206, 255))
    draw.line([(32, 18), (32, 38)], fill=(255, 255, 255, 255), width=6)
    draw.polygon([(23, 34), (41, 34), (32, 46)], fill=(255, 255, 255, 255))
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
    _log("=== Launcher starting ===")

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    def _delayed_open() -> None:
        time.sleep(2.0)
        _open_browser()

    threading.Thread(target=_delayed_open, daemon=True).start()

    try:
        _run_tray()
    except Exception:
        _log("TRAY CRASHED:\n" + traceback.format_exc())
        raise
