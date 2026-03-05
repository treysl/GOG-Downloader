"""
GOG API client: library list and product downloads (with Bearer token).
"""
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from deps import get_valid_token

EMBED_BASE = "https://embed.gog.com"
API_BASE = "https://api.gog.com"

router = APIRouter()

# sortBy values known to work with embed.gog.com/account/getFilteredProducts
# (rating is not supported and causes 500; map it to date_purchased)
LIBRARY_SORT_WHITELIST = {"title", "releaseDate", "dateAdded", "date_purchased"}
LIBRARY_SORT_DEFAULT = "title"

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
    sortBy: str = "title",
    token: str = Depends(get_valid_token),
):
    """Return user's library (owned games) with thumbnails for the grid."""
    # Only pass sortBy values that GOG accepts; rating is not supported
    sort_by = sortBy.strip() if sortBy else ""
    if sort_by not in LIBRARY_SORT_WHITELIST:
        sort_by = LIBRARY_SORT_DEFAULT
    params = {"mediaType": 1, "page": page, "sortBy": sort_by}
    if search:
        params["search"] = search
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{EMBED_BASE}/account/getFilteredProducts",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        detail = f"GOG API error: {e.response.status_code}"
        try:
            body = e.response.json()
            if isinstance(body, dict) and "detail" in body:
                detail = body["detail"]
            elif isinstance(body, dict) and "message" in body:
                detail = body["message"]
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"GOG API request failed: {e!s}")

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
