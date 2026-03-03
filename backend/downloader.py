"""
Download worker: queue, stream files from GOG downlinks, progress state.
"""
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel

from deps import get_valid_token, COOKIE_NAME

router = APIRouter()


class DownloadRequest(BaseModel):
    gameIds: List[int]
    path: str = "."
    includeBonus: bool = True
API_BASE = "https://api.gog.com"

# Base path allowed for downloads (env DOWNLOAD_PATH, default /downloads)
DOWNLOAD_BASE = os.environ.get("DOWNLOAD_PATH", "/downloads")

# session_id -> download state
_download_state: Dict[str, Dict[str, Any]] = {}


def _safe_filename(name: str) -> str:
    """Remove path-unsafe characters from a filename."""
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name.strip() or "file"


def _resolve_path(user_path: str, session_id: str) -> Path:
    """Resolve and validate that user_path is under DOWNLOAD_BASE."""
    base = Path(DOWNLOAD_BASE).resolve()
    try:
        full = (base / user_path.lstrip("/")).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not str(full).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Path must be under download base")
    return full


async def _run_download_job(
    session_id: str,
    game_ids: List[int],
    base_path: Path,
    include_bonus: bool,
    token: str,
):
    """Background job: for each game, fetch product downloads and stream files to base_path."""
    state = _download_state.get(session_id)
    if not state:
        return
    state["status"] = "downloading"
    state["failed"] = []

    for game_id in game_ids:
        state["current_game_id"] = game_id
        state["current_game_title"] = ""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{API_BASE}/products/{game_id}",
                    params={"expand": "downloads"},
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            state["failed"].append({"game_id": game_id, "error": str(e)})
            continue

        slug = data.get("slug") or f"game_{game_id}"
        title = data.get("title") or slug
        state["current_game_title"] = title
        game_dir = base_path / _safe_filename(slug)
        game_dir.mkdir(parents=True, exist_ok=True)

        # Collect all files to download: installers + optionally bonus
        downloads = data.get("downloads", {})
        files_to_download: List[Tuple[str, str, int]] = []  # (downlink, filename, size)
        for inst in downloads.get("installers", []):
            inst_name = _safe_filename(inst.get("name", "installer"))
            os_type = inst.get("os", "").lower()
            ext = ".exe" if "win" in os_type else ".sh" if "mac" in os_type or "osx" in os_type else ".bin"
            for i, f in enumerate(inst.get("files", [])):
                downlink = f.get("downlink")
                if downlink:
                    file_id = f.get("id", f"part{i}")
                    filename = f"{inst_name}_{file_id}{ext}" if len(inst.get("files", [])) > 1 else f"{inst_name}{ext}"
                    files_to_download.append((downlink, _safe_filename(filename), f.get("size", 0)))
        if include_bonus:
            for bonus in downloads.get("bonus_content", []):
                for f in bonus.get("files", []):
                    downlink = f.get("downlink")
                    if downlink:
                        name = bonus.get("name", str(f.get("id", "bonus")))
                        files_to_download.append((
                            downlink,
                            _safe_filename(name) + ".bin",
                            f.get("size", 0),
                        ))

        for downlink, filename, size in files_to_download:
            state["current_file"] = filename
            state["bytes_total"] = size
            state["bytes_done"] = 0
            out_path = game_dir / filename
            try:
                async with httpx.AsyncClient() as client:
                    async with client.stream(
                        "GET",
                        downlink,
                        headers={"Authorization": f"Bearer {token}"},
                        follow_redirects=True,
                    ) as resp:
                        resp.raise_for_status()
                        total = int(resp.headers.get("content-length", 0) or size)
                        state["bytes_total"] = total
                        done = 0
                        with open(out_path, "wb") as fp:
                            async for chunk in resp.aiter_bytes(chunk_size=262144):
                                fp.write(chunk)
                                done += len(chunk)
                                state["bytes_done"] = done
                state["completed"].append({"game_id": game_id, "title": title, "file": filename})
            except Exception as e:
                state["failed"].append({"game_id": game_id, "file": filename, "error": str(e)})

    state["status"] = "idle"
    state["current_game_id"] = None
    state["current_game_title"] = ""
    state["current_file"] = ""
    state["bytes_done"] = 0
    state["bytes_total"] = 0


@router.get("/downloads/status")
async def get_download_status(request: Request):
    """Return current download progress for the session."""
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        return {"status": "idle", "logged_in": False}
    state = _download_state.get(session_id)
    if not state:
        return {
            "status": "idle",
            "current_game_id": None,
            "current_game_title": "",
            "current_file": "",
            "bytes_done": 0,
            "bytes_total": 0,
            "completed": [],
            "failed": [],
        }
    return {
        "status": state["status"],
        "current_game_id": state.get("current_game_id"),
        "current_game_title": state.get("current_game_title", ""),
        "current_file": state.get("current_file", ""),
        "bytes_done": state.get("bytes_done", 0),
        "bytes_total": state.get("bytes_total", 0),
        "completed": state.get("completed", []),
        "failed": state.get("failed", []),
    }


@router.post("/download")
async def start_download(
    request: Request,
    background_tasks: BackgroundTasks,
    body: DownloadRequest,
    token: str = Depends(get_valid_token),
):
    """Start background download of selected games."""
    game_ids = body.gameIds or []
    if not game_ids:
        raise HTTPException(status_code=400, detail="gameIds required")
    path_str = (body.path or ".").strip() or "."
    include_bonus = body.includeBonus
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    base_path = _resolve_path(path_str, session_id)
    base_path.mkdir(parents=True, exist_ok=True)

    _download_state[session_id] = {
        "status": "queued",
        "current_game_id": None,
        "current_game_title": "",
        "current_file": "",
        "bytes_done": 0,
        "bytes_total": 0,
        "completed": [],
        "failed": [],
    }

    background_tasks.add_task(
        _run_download_job,
        session_id,
        game_ids,
        base_path,
        include_bonus,
        token,
    )
    return {"status": "started", "game_count": len(game_ids)}


@router.get("/downloads/path")
async def get_download_path():
    """Return the configured download base path (for UI display)."""
    return {"path": DOWNLOAD_BASE }