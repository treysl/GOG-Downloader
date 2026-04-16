"""
Download worker: queue, stream files from GOG downlinks, progress state.
"""
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel

from auth import is_token_expired, refresh_tokens
from config import get_download_path, set_download_path
from deps import get_valid_token, COOKIE_NAME
from session_store import get_session, set_session

router = APIRouter()


class DownloadRequest(BaseModel):
    gameIds: List[int]
    path: str = "."
    includeBonus: bool = True
API_BASE = "https://api.gog.com"

# session_id -> download state
_download_state: Dict[str, Dict[str, Any]] = {}

# Placeholder filename so the UI shows all games in the queue before we fetch their file lists
_QUEUED_PLACEHOLDER = "(queued)"


def _replace_queued_placeholder_with_files(
    state: Dict[str, Any], game_id: int, title: str, files: List[Tuple[str, str, int]]
) -> None:
    """Replace the single '(queued)' placeholder for this game with real file entries (keeps queue order)."""
    q = state.get("queue", [])
    for i, entry in enumerate(q):
        if entry.get("game_id") == game_id and entry.get("filename") == _QUEUED_PLACEHOLDER:
            new_entries = [
                {"game_id": game_id, "game_title": title, "filename": filename}
                for _, filename, _ in files
            ]
            state["queue"] = q[:i] + new_entries + q[i + 1:]
            return


def _safe_filename(name: str) -> str:
    """Remove path-unsafe characters from a filename."""
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name.strip() or "file"


def _resolve_path(user_path: str, session_id: str) -> Path:
    """Resolve and validate that user_path is under the configured download base."""
    base = Path(get_download_path()).resolve()
    try:
        full = (base / user_path.lstrip("/")).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not full.is_relative_to(base):
        raise HTTPException(status_code=400, detail="Path must be under download base")
    return full


async def _get_fresh_token(session_id: str) -> str:
    """Return a valid GOG access token for the session, refreshing it if expired."""
    session = get_session(session_id)
    if not session or not session.get("access_token"):
        raise RuntimeError("Session not found; please log in again")
    if is_token_expired(session.get("expires_at", 0)):
        new_tokens = await refresh_tokens(session["refresh_token"])
        set_session(session_id, new_tokens)
        return new_tokens["access_token"]
    return session["access_token"]


async def _run_download_job(
    session_id: str,
    game_ids: List[int],
    base_path: Path,
    include_bonus: bool,
):
    """Background job: sequentially download every file for each game."""
    state = _download_state.get(session_id)
    if not state:
        return
    state["status"] = "downloading"
    state["failed"] = []
    state["queue"] = []
    state["cancel_requested"] = False

    async with httpx.AsyncClient(
        headers={
            "User-Agent": "GOGGalaxyClient/2.0.58.16",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Referer": "https://www.gog.com/",
        },
        follow_redirects=True,
        timeout=httpx.Timeout(30.0, connect=10.0),
    ) as client:
        # Pre-populate queue with one entry per game so the UI shows all selected games immediately.
        for game_id in game_ids:
            if state.get("cancel_requested"):
                break
            try:
                token = await _get_fresh_token(session_id)
                r = await client.get(
                    f"{API_BASE}/products/{game_id}",
                    params={"expand": "downloads"},
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                data = r.json()
                title = data.get("title") or data.get("slug") or f"Game {game_id}"
            except Exception:
                title = f"Game {game_id}"
            state["queue"].append({
                "game_id": game_id,
                "game_title": title,
                "filename": _QUEUED_PLACEHOLDER,
            })

        for game_idx, game_id in enumerate(game_ids):
            if state.get("cancel_requested"):
                break
            state["current_game_id"] = game_id
            state["current_game_title"] = ""
            state["pending_games"] = len(game_ids) - game_idx
            try:
                token = await _get_fresh_token(session_id)
                r = await client.get(
                    f"{API_BASE}/products/{game_id}",
                    params={"expand": "downloads"},
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                state["failed"].append({"game_id": game_id, "error": str(e)})
                _replace_queued_placeholder_with_files(state, game_id, f"Game {game_id}", [])
                continue

            slug = data.get("slug") or f"game_{game_id}"
            title = data.get("title") or slug
            state["current_game_title"] = title
            game_dir = base_path / _safe_filename(slug)
            game_dir.mkdir(parents=True, exist_ok=True)

            downloads = data.get("downloads", {})
            files_to_download: List[Tuple[str, str, int]] = []  # (downlink, filename, size)
            for inst in downloads.get("installers", []):
                inst_name = _safe_filename(inst.get("name", "installer"))
                os_type = inst.get("os", "").lower()
                ext = ".exe" if "win" in os_type else ".pkg" if "mac" in os_type or "osx" in os_type else ".sh"
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
                            files_to_download.append(
                                (
                                    downlink,
                                    _safe_filename(name) + ".bin",
                                    f.get("size", 0),
                                )
                            )

            # Replace the "(queued)" placeholder with real file entries for this game (keeps queue order).
            _replace_queued_placeholder_with_files(state, game_id, title, files_to_download)

            for downlink, filename, size in files_to_download:
                # Stop immediately if a cancel was requested between files.
                if state.get("cancel_requested"):
                    break

                # Pop the front of the queue as this file becomes active.
                if state["queue"] and state["queue"][0].get("filename") == filename:
                    state["queue"].pop(0)

                state["current_file"] = filename
                state["bytes_total"] = size
                state["bytes_done"] = 0
                state["speed_bps"] = 0
                state["_speed_sample_time"] = time.monotonic()
                state["_speed_sample_bytes"] = 0
                out_path = game_dir / filename
                try:
                    # Resolve the real CDN URL from the GOG downlink endpoint.
                    # Refresh the token immediately before each API call so long
                    # multi-part downloads don't hit 401s after the token expires.
                    try:
                        token = await _get_fresh_token(session_id)
                        meta_resp = await client.get(
                            downlink,
                            headers={"Authorization": f"Bearer {token}"},
                        )
                        meta_resp.raise_for_status()
                        meta = meta_resp.json()
                        cdn_url = meta.get("downlink") or meta.get("url")
                        if not cdn_url:
                            raise RuntimeError("Missing 'downlink' field in GOG response")
                    except Exception as e:
                        raise RuntimeError(f"Failed to resolve installer downlink: {e}")

                    cancelled_mid_stream = False
                    async with client.stream("GET", cdn_url) as resp:
                        resp.raise_for_status()

                        ct = (resp.headers.get("content-type") or "").lower()
                        if "text/html" in ct or "application/json" in ct:
                            # Read only first 1KB for error message; never load full body into RAM
                            snippet = b""
                            async for chunk in resp.aiter_bytes(chunk_size=1024):
                                snippet += chunk
                                if len(snippet) >= 1024:
                                    break
                            snippet = snippet[:1024]
                            try:
                                snippet_text = snippet.decode("utf-8", errors="ignore")
                            except Exception:
                                snippet_text = ""
                            raise RuntimeError(
                                f"Unexpected content-type {ct} from CDN downlink; "
                                f"response starts with: {snippet_text[:200]!r}"
                            )

                        total = int(resp.headers.get("content-length", 0) or size)
                        state["bytes_total"] = total
                        done = 0
                        with open(out_path, "wb") as fp:
                            async for chunk in resp.aiter_bytes(chunk_size=262144):
                                if state.get("cancel_requested"):
                                    cancelled_mid_stream = True
                                    break
                                fp.write(chunk)
                                done += len(chunk)
                                state["bytes_done"] = done
                                now = time.monotonic()
                                elapsed = now - state.get("_speed_sample_time", now)
                                # Update a rolling speed estimate a few times per second.
                                if elapsed >= 0.5:
                                    prev_bytes = state.get("_speed_sample_bytes", 0)
                                    delta = done - prev_bytes
                                    state["speed_bps"] = max(0, int(delta / elapsed))
                                    state["_speed_sample_time"] = now
                                    state["_speed_sample_bytes"] = done

                    if cancelled_mid_stream:
                        try:
                            out_path.unlink()
                        except OSError:
                            pass
                        break  # exit the files loop; game loop will also break on next iteration

                    try:
                        actual_size = out_path.stat().st_size
                    except OSError:
                        actual_size = 0

                    expected_size = size or total
                    if expected_size and actual_size < max(int(expected_size * 0.5), 1024):
                        try:
                            out_path.unlink()
                        except OSError:
                            pass
                        state["failed"].append(
                            {
                                "game_id": game_id,
                                "file": filename,
                                "error": (
                                    f"Downloaded size {actual_size} bytes looks invalid "
                                    f"(expected at least {expected_size} bytes). "
                                    "GOG likely returned an error page instead of the installer."
                                ),
                            }
                        )
                        continue

                    state["completed"].append({"game_id": game_id, "title": title, "file": filename})
                except Exception as e:
                    try:
                        if out_path.exists():
                            out_path.unlink()
                    except OSError:
                        pass
                    state["failed"].append({"game_id": game_id, "file": filename, "error": str(e)})

    state["status"] = "cancelled" if state.get("cancel_requested") else "idle"
    state["current_game_id"] = None
    state["current_game_title"] = ""
    state["current_file"] = ""
    state["bytes_done"] = 0
    state["bytes_total"] = 0
    state["speed_bps"] = 0
    state["pending_games"] = 0
    state["queue"] = []
    state["cancel_requested"] = False


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
            "pending_games": 0,
            "speed_bps": 0,
            "queue": [],
            "completed": [],
            "failed": [],
            "cancel_requested": False,
        }
    return {
        "status": state["status"],
        "current_game_id": state.get("current_game_id"),
        "current_game_title": state.get("current_game_title", ""),
        "current_file": state.get("current_file", ""),
        "bytes_done": state.get("bytes_done", 0),
        "bytes_total": state.get("bytes_total", 0),
        "speed_bps": state.get("speed_bps", 0),
        "pending_games": state.get("pending_games", 0),
        "queue": state.get("queue", []),
        "completed": state.get("completed", []),
        "failed": state.get("failed", []),
        "cancel_requested": state.get("cancel_requested", False),
    }


@router.post("/downloads/cancel")
async def cancel_download(request: Request):
    """Request cancellation of the active download job for this session."""
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    state = _download_state.get(session_id)
    if not state or state.get("status") not in ("queued", "downloading"):
        raise HTTPException(status_code=400, detail="No active download to cancel")
    state["cancel_requested"] = True
    return {"status": "cancellation requested"}


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
        "speed_bps": 0,
        "_speed_sample_time": 0.0,
        "_speed_sample_bytes": 0,
        "pending_games": len(game_ids),
        "queue": [],
        "completed": [],
        "failed": [],
        "cancel_requested": False,
    }

    background_tasks.add_task(
        _run_download_job,
        session_id,
        game_ids,
        base_path,
        include_bonus,
    )
    return {"status": "started", "game_count": len(game_ids)}


@router.get("/downloads/path")
async def get_download_path_endpoint(token: str = Depends(get_valid_token)):
    """Return the configured download base path."""
    return {"path": get_download_path()}


@router.put("/downloads/path")
async def set_download_path_endpoint(
    body: dict,
    token: str = Depends(get_valid_token),
):
    """Update the download base path.  Creates the directory if it does not exist."""
    new_path = (body.get("path") or "").strip()
    if not new_path:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="path is required")
    target = Path(new_path)
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Cannot create directory: {exc}")
    set_download_path(str(target.resolve()))
    return {"path": get_download_path()}


def _list_dir_safe(base: Path, subpath: str) -> Path:
    """Resolve subpath under base; raise HTTPException if invalid or not a directory."""
    base = base.resolve()
    try:
        full = (base / subpath.strip().strip("/")).resolve() if subpath.strip() else base
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not full.is_relative_to(base):
        raise HTTPException(status_code=400, detail="Path must be under download base")
    if not full.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not full.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")
    return full


@router.get("/downloads/files")
async def list_download_files(
    path: str = "",
    token: str = Depends(get_valid_token),
):
    """
    List contents of the download folder (and optional subpath).
    Returns entries with name, path (relative to base), size (files only), isDir.
    """
    base = Path(get_download_path()).resolve()
    full = _list_dir_safe(base, path)
    entries = []
    try:
        for entry in sorted(full.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            rel = entry.relative_to(base)
            size = entry.stat().st_size if entry.is_file() else None
            entries.append({
                "name": entry.name,
                "path": str(rel).replace("\\", "/"),
                "size": size,
                "isDir": entry.is_dir(),
            })
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Cannot list directory: {e}")
    return {
        "path": str(full.relative_to(base)).replace("\\", "/") if full != base else "",
        "entries": entries,
        "basePath": get_download_path(),
    }