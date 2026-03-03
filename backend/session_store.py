"""
In-memory session store for GOG tokens. Keyed by session id (from cookie).
"""
import secrets
from typing import Any, Dict, Optional

# session_id -> { "access_token", "refresh_token", "expires_at" }
_sessions: Dict[str, Dict[str, Any]] = {}


def create_session_id() -> str:
    return secrets.token_urlsafe(32)


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    return _sessions.get(session_id)


def set_session(session_id: str, data: Dict[str, Any]) -> None:
    _sessions[session_id] = data


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
