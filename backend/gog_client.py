"""
GOG API client: library list and product downloads (with Bearer token).
"""
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends

from deps import get_valid_token

EMBED_BASE = "https://embed.gog.com"
API_BASE = "https://api.gog.com"

router = APIRouter()

# Matches a 64-char hex string (GOG image hash)
_HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def _normalize_image(url: Optional[str]) -> str:
    """
    Turn whatever GOG returns for an image into a working HTTPS URL.

    Possible input formats:
      - "//images-2.gog.com/{hash}"           -> prepend https:, append .jpg
      - "https://images-2.gog.com/{hash}.jpg" -> pass through
      - "{bare 64-char hex hash}"             -> construct full CDN URL
      - None / empty                          -> ""
    """
    if not url:
        return ""
    url = str(url).strip()

    if url.startswith("//"):
        url = "https:" + url

    if url.startswith("http://") or url.startswith("https://"):
        # Already a full URL; make sure it has a file extension so the CDN serves an image
        if not url.endswith((".jpg", ".png", ".webp", ".gif")):
            url += ".jpg"
        return url

    # Bare hex hash (no host, no protocol)
    if _HASH_RE.match(url):
        return f"https://images.gog.com/{url}.jpg"

    # Unknown format; skip
    return ""


@router.get("/library")
async def get_library(
    search: Optional[str] = None,
    page: int = 1,
    token: str = Depends(get_valid_token),
):
    """Return user's library (owned games) with thumbnails for the grid."""
    params = {"mediaType": 1, "page": page}  # 1 = games
    if search:
        params["search"] = search
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{EMBED_BASE}/account/getFilteredProducts",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json()

    products = data.get("products", [])
    for p in products:
        p["image"] = _normalize_image(p.get("image"))

    return {
        "products": products,
        "page": data.get("page", 1),
        "totalPages": data.get("totalPages", 1),
        "totalProducts": data.get("totalProducts", 0),
    }


@router.get("/products/{product_id}/downloads")
async def get_product_downloads(
    product_id: int,
    token: str = Depends(get_valid_token),
):
    """Return download links (installers + bonus content) for a product."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/products/{product_id}",
            params={"expand": "downloads"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json()

    downloads = data.get("downloads", {})
    installers = downloads.get("installers", [])
    bonus_content = downloads.get("bonus_content", [])
    return {
        "id": data.get("id"),
        "slug": data.get("slug"),
        "title": data.get("title"),
        "installers": installers,
        "bonus_content": bonus_content,
    }
