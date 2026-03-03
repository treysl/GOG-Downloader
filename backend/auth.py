"""
GOG OAuth: login redirect, callback, token exchange, and refresh.
"""
import os
import time
from urllib.parse import urlencode

import httpx

GOG_AUTH_URL = "https://auth.gog.com/auth"
GOG_TOKEN_URL = "https://auth.gog.com/token"
# Redirect used by the official GOG client (works with the public client id)
EMBED_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client"

# Public client from GOG API docs (for testing; can override via env)
DEFAULT_CLIENT_ID = "46899977096215655"
DEFAULT_CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"


def get_config():
    return {
        "client_id": os.environ.get("GOG_CLIENT_ID", DEFAULT_CLIENT_ID),
        "client_secret": os.environ.get("GOG_CLIENT_SECRET", DEFAULT_CLIENT_SECRET),
        "redirect_uri": os.environ.get(
            "REDIRECT_URI", "http://localhost:8080/auth/callback"
        ),
    }


def get_login_redirect_url():
    """Build URL to send the user to GOG login."""
    config = get_config()
    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "layout": "client2",
    }
    return f"{GOG_AUTH_URL}?{urlencode(params)}"


def get_manual_login_url() -> str:
    """
    Build URL for manual login flow.

    In this mode the user logs in on GOG and copies the final URL
    (which contains the authorization code) back into our app.
    We must use the same redirect URI that the public client is
    registered with, which is EMBED_REDIRECT_URI.
    """
    config = get_config()
    params = {
        "client_id": config["client_id"],
        "redirect_uri": EMBED_REDIRECT_URI,
        "response_type": "code",
        "layout": "client2",
    }
    return f"{GOG_AUTH_URL}?{urlencode(params)}"


async def _exchange_code_for_tokens_with_redirect(code: str, redirect_uri: str) -> dict:
    """Low-level helper for exchanging code for tokens with a specific redirect_uri."""
    config = get_config()
    async with httpx.AsyncClient() as client:
        # GOG docs show GET for /token; some implementations use POST with form body
        resp = await client.get(
            GOG_TOKEN_URL,
            params={
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_in": data.get("expires_in", 3600),
        "expires_at": time.time() + data.get("expires_in", 3600),
    }


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access_token and refresh_token (standard redirect)."""
    config = get_config()
    return await _exchange_code_for_tokens_with_redirect(code, config["redirect_uri"])


async def exchange_code_for_tokens_manual(code: str) -> dict:
    """
    Exchange authorization code for tokens using the embed.gog.com redirect.

    This is used for the manual login flow where the user copies the final
    URL from the browser and pastes it into the app.
    """
    return await _exchange_code_for_tokens_with_redirect(code, EMBED_REDIRECT_URI)


async def refresh_tokens(refresh_token: str) -> dict:
    """Refresh access token using refresh_token."""
    config = get_config()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOG_TOKEN_URL,
            params={
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", refresh_token),
        "expires_in": data.get("expires_in", 3600),
        "expires_at": time.time() + data.get("expires_in", 3600),
    }


def is_token_expired(expires_at: float, buffer_seconds: int = 300) -> bool:
    """Return True if token is expired or within buffer_seconds of expiry."""
    return time.time() >= (expires_at - buffer_seconds)
