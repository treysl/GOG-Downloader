# Security policy

## Supported threat model

GOG Downloader is designed for **single-user, local use** on a **trusted machine**:

- The packaged Windows launcher binds the API server to **127.0.0.1** only (not exposed to the LAN by default).
- Sessions and GOG tokens are kept **in memory** on your PC; they are cleared when the process exits.
- The app does not send your library or downloads to third parties beyond **GOG’s own APIs** (authentication and game metadata / installers).

If you expose the service beyond localhost (for example by changing host binding or putting it behind a reverse proxy), you are outside the supported model and should add TLS, access control, and network hardening appropriate to your environment.

## OAuth client credentials in the repository

This project uses GOG’s **public OAuth client** credentials (client id and client secret) that are documented for use by GOG-related clients. They are **not** your personal GOG password and are **not** a secret unique to your fork. Forks and clones may keep the same values unless GOG’s terms require otherwise.

## Cookies

Session cookies use `HttpOnly` and `SameSite=Lax` and are **not** marked `Secure` because the app commonly runs over **plain HTTP on localhost**. If you deploy over **HTTPS**, you should set the `Secure` cookie flag for that deployment.

## Download path

An authenticated session can set the download directory to any path the OS user can write to. That is intentional for a downloader. Anyone who can use your logged-in session on that machine can trigger writes under that user account.

## Reporting a vulnerability

If you believe you have found a security vulnerability, please **do not** open a public GitHub issue with exploit details.

- Prefer **GitHub Security Advisories** (repository **Security** tab → **Report a vulnerability**) if private reporting is enabled, **or**
- Open a **private** discussion with the maintainers if that channel is documented in the repository.

Include enough detail to reproduce the issue (version, OS, steps) and, if possible, suggested impact and mitigation.

## Dependency scanning

Before releases, maintainers run tooling such as `pip-audit` (Python) and `npm audit` (frontend dev dependencies). The shipped Windows build serves **pre-built static frontend assets**; Vite/esbuild advisories primarily affect `npm run dev`, not end users of the compiled app.
