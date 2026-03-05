"""
Local tag store: persist tag definitions and per-game tag assignments to a JSON
file inside the downloads volume so they survive container restarts.

Data layout on disk:
  {
    "tags":      { "<name>": { "color": "#hex" }, ... },
    "game_tags": { "<product_id>": ["name", ...], ... }
  }
"""
import json
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from deps import COOKIE_NAME
from session_store import get_session

DOWNLOAD_BASE = os.environ.get("DOWNLOAD_PATH", "/downloads")

_PALETTE = [
    "#7e4dd2", "#4c994a", "#d94545", "#d97b45",
    "#4590d9", "#d945b8", "#45d9c8", "#9b8a2a",
    "#a0a0a0", "#5ca8d9", "#c47c3e", "#5a8a5a",
]

router = APIRouter()


# ── helpers ─────────────────────────────────────────────────────────────────

def _tags_file() -> Path:
    return Path(DOWNLOAD_BASE) / ".gog_tags.json"


def _load() -> dict:
    f = _tags_file()
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"tags": {}, "game_tags": {}}


def _save(data: dict) -> None:
    f = _tags_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _require_session(request: Request) -> None:
    sid = request.cookies.get(COOKIE_NAME)
    if not sid or not get_session(sid):
        raise HTTPException(status_code=401, detail="Not logged in")


# ── models ───────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class GameTagsSet(BaseModel):
    tags: List[str]


# ── routes ───────────────────────────────────────────────────────────────────

@router.get("/tags")
def get_all_tags(request: Request):
    """Return all tag definitions and every game's tag assignments."""
    _require_session(request)
    data = _load()
    return {
        "tags":      data.get("tags", {}),
        "game_tags": data.get("game_tags", {}),
    }


@router.post("/tags", status_code=201)
def create_tag(request: Request, body: TagCreate):
    """Create a new tag. Auto-assigns a color from the palette if none is given."""
    _require_session(request)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name required")
    data = _load()
    if name in data.get("tags", {}):
        raise HTTPException(status_code=409, detail="Tag already exists")
    used = {v["color"] for v in data.get("tags", {}).values()}
    color = body.color or next((c for c in _PALETTE if c not in used), _PALETTE[0])
    data.setdefault("tags", {})[name] = {"color": color}
    _save(data)
    return {"name": name, "color": color}


@router.put("/tags/{tag_name}")
def update_tag(request: Request, tag_name: str, body: TagUpdate):
    """Rename a tag and/or change its color. Propagates renames to all games."""
    _require_session(request)
    data = _load()
    if tag_name not in data.get("tags", {}):
        raise HTTPException(status_code=404, detail="Tag not found")

    new_name = (body.name or "").strip() or tag_name
    color = body.color or data["tags"][tag_name]["color"]

    if new_name != tag_name:
        if new_name in data["tags"]:
            raise HTTPException(status_code=409, detail="Tag name already in use")
        data["tags"][new_name] = {"color": color}
        del data["tags"][tag_name]
        for gid in data.get("game_tags", {}):
            data["game_tags"][gid] = [
                new_name if t == tag_name else t
                for t in data["game_tags"][gid]
            ]
    else:
        data["tags"][tag_name]["color"] = color

    _save(data)
    return {"name": new_name, "color": color}


@router.delete("/tags/{tag_name}", status_code=204)
def delete_tag(request: Request, tag_name: str):
    """Delete a tag and remove it from all games."""
    _require_session(request)
    data = _load()
    if tag_name not in data.get("tags", {}):
        raise HTTPException(status_code=404, detail="Tag not found")
    del data["tags"][tag_name]
    for gid in list(data.get("game_tags", {}).keys()):
        data["game_tags"][gid] = [t for t in data["game_tags"][gid] if t != tag_name]
    _save(data)


@router.put("/games/{product_id}/tags")
def set_game_tags(request: Request, product_id: int, body: GameTagsSet):
    """Overwrite the tag list for a single game (only keeps known tags)."""
    _require_session(request)
    data = _load()
    valid = set(data.get("tags", {}).keys())
    tags = [t for t in body.tags if t in valid]
    data.setdefault("game_tags", {})[str(product_id)] = tags
    _save(data)
    return {"tags": tags}
