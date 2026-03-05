"""
FastAPI app: auth, CORS, and route wiring.
"""
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from auth import (
    get_login_redirect_url,
    get_manual_login_url,
    exchange_code_for_tokens,
    exchange_code_for_tokens_manual,
    refresh_tokens,
    is_token_expired,
)
from session_store import (
    create_session_id,
    get_session,
    set_session,
)

COOKIE_NAME = "gog_session"
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if getattr(sys, "frozen", False):
        # Running as a PyInstaller bundle — data files land in sys._MEIPASS
        base = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        # Development — main.py lives in backend/, frontend/dist is one level up
        base = Path(__file__).resolve().parent.parent
    static_dir = base / "frontend" / "dist"
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
    yield


app = FastAPI(title="GOG Offline Library Downloader", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session_id(request: Request) -> Optional[str]:
    return request.cookies.get(COOKIE_NAME)


# ---------- Auth routes ----------


@app.get("/auth/login")
async def auth_login(response: Response):
    """Redirect user to GOG login."""
    url = get_login_redirect_url()
    return RedirectResponse(url=url)


@app.get("/auth/callback")
async def auth_callback(
    request: Request,
    response: Response,
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle OAuth callback: exchange code for tokens and redirect to frontend."""
    if error:
        # Redirect to frontend with error (e.g. user denied)
        return RedirectResponse(url=f"{FRONTEND_ORIGIN}/?error={error}")
    if not code:
        return RedirectResponse(url=f"{FRONTEND_ORIGIN}/?error=missing_code")

    try:
        tokens = await exchange_code_for_tokens(code)
    except Exception as e:
        return RedirectResponse(
            url=f"{FRONTEND_ORIGIN}/?error=token_exchange_failed"
        )

    session_id = create_session_id()
    set_session(session_id, tokens)

    redirect = RedirectResponse(url=f"{FRONTEND_ORIGIN}/")
    cookie_kw = {
        "key": COOKIE_NAME,
        "value": session_id,
        "httponly": True,
        "samesite": "lax",
        "max_age": 60 * 60 * 24 * 7,  # 7 days
    }
    if "localhost" in FRONTEND_ORIGIN:
        cookie_kw["domain"] = "localhost"
    redirect.set_cookie(**cookie_kw)
    return redirect


@app.get("/auth/manual-url")
async def auth_manual_url():
    """
    Return the URL the user should open in a browser to log into GOG manually.

    After login, GOG redirects to embed.gog.com with a ?code=... parameter.
    The user copies that full URL back into the app.
    """
    return {"url": get_manual_login_url()}


@app.post("/auth/manual-complete")
async def auth_manual_complete(request: Request, body: dict):
    """
    Complete manual login.

    Body can contain either:
      - {"url": "<full redirect URL from browser address bar>"}
      - {"code": "<authorization code>"}
    """
    url = body.get("url") or ""
    code = body.get("code") or ""

    if url and not code:
        from urllib.parse import urlparse, parse_qs

        try:
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            code_values = qs.get("code") or []
            if code_values:
                code = code_values[0]
        except Exception:
            raise HTTPException(status_code=400, detail="Could not parse code from URL")

    if not code:
        raise HTTPException(status_code=400, detail="Missing code or url")

    try:
        tokens = await exchange_code_for_tokens_manual(code)
    except Exception:
        raise HTTPException(status_code=400, detail="Token exchange failed")

    session_id = create_session_id()
    set_session(session_id, tokens)

    response = {"ok": True}
    # Use Response object to set cookie while returning JSON
    from fastapi.responses import JSONResponse

    res = JSONResponse(content=response)
    cookie_kw = {
        "key": COOKIE_NAME,
        "value": session_id,
        "httponly": True,
        "samesite": "lax",
        "max_age": 60 * 60 * 24 * 7,  # 7 days
    }
    if "localhost" in FRONTEND_ORIGIN:
        cookie_kw["domain"] = "localhost"
    res.set_cookie(**cookie_kw)
    return res


@app.get("/auth/logout")
async def auth_logout(request: Request, response: Response):
    """Clear session and redirect to frontend."""
    session_id = get_session_id(request)
    if session_id:
        from session_store import delete_session
        delete_session(session_id)
    redirect = RedirectResponse(url=f"{FRONTEND_ORIGIN}/")
    redirect.delete_cookie(COOKIE_NAME)
    return redirect


@app.get("/auth/status")
async def auth_status(request: Request):
    """Return whether the user is logged in (and optionally user id)."""
    session_id = get_session_id(request)
    if not session_id:
        return {"logged_in": False}
    session = get_session(session_id)
    if not session or not session.get("access_token"):
        return {"logged_in": False}
    return {"logged_in": True}


# ---------- Health ----------


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------- API and download routes ----------

from gog_client import router as gog_router
from downloader import router as download_router
from tags import router as tags_router

app.include_router(gog_router, prefix="/api", tags=["api"])
app.include_router(download_router, prefix="/api", tags=["downloads"])
app.include_router(tags_router, prefix="/api", tags=["tags"])


# ---------- Static files (frontend) - mounted in lifespan ----------
