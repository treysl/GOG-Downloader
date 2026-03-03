"""Shared dependencies for FastAPI (e.g. get valid GOG token)."""
from fastapi import Request, HTTPException

from auth import is_token_expired, refresh_tokens
from session_store import get_session, set_session

COOKIE_NAME = "gog_session"


async def get_valid_token(request: Request) -> str:
    """Return valid access token, refreshing if expired. Raises 401 if not logged in."""
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    session = get_session(session_id)
    if not session or not session.get("access_token"):
        raise HTTPException(status_code=401, detail="Not logged in")
    if is_token_expired(session.get("expires_at", 0)):
        try:
            new_tokens = await refresh_tokens(session["refresh_token"])
            set_session(session_id, new_tokens)
            return new_tokens["access_token"]
        except Exception:
            raise HTTPException(status_code=401, detail="Session expired; please log in again")
    return session["access_token"]
