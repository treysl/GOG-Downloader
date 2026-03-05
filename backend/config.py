"""
Runtime configuration for GOG Downloader.

Stores settings (currently just the download path) in a JSON file under
~/.gog-downloader/ so they persist across app restarts and survive updates
to the install folder.
"""
import json
import os
from pathlib import Path

_CONFIG_DIR = Path.home() / ".gog-downloader"
_CONFIG_FILE = _CONFIG_DIR / "config.json"

_DEFAULT_DOWNLOAD_PATH = os.environ.get(
    "DOWNLOAD_PATH",
    str(Path.home() / "Downloads" / "GOG"),
)

_config: dict | None = None


def _load() -> dict:
    global _config
    if _config is not None:
        return _config
    defaults = {"download_path": _DEFAULT_DOWNLOAD_PATH}
    if _CONFIG_FILE.exists():
        try:
            data = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            defaults.update(data)
        except Exception:
            pass
    _config = defaults
    return _config


def _save(data: dict) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def get_download_path() -> str:
    """Return the currently configured download base path."""
    return _load()["download_path"]


def set_download_path(path: str) -> str:
    """Persist a new download path and return the normalised value."""
    cfg = _load()
    cfg["download_path"] = path
    _save(cfg)
    return path
