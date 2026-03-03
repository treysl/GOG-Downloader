const API_BASE = "";

function fetchOpts(extra = {}) {
  return { credentials: "include", ...extra };
}

export async function getAuthStatus() {
  const r = await fetch(`${API_BASE}/auth/status`, fetchOpts());
  return r.json();
}

export async function getManualLoginUrl() {
  const r = await fetch(`${API_BASE}/auth/manual-url`, fetchOpts());
  if (!r.ok) throw new Error("Failed to get login URL");
  return r.json();
}

export async function completeManualLogin(payload) {
  const r = await fetch(`${API_BASE}/auth/manual-complete`, {
    ...fetchOpts(),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Manual login failed");
  }
  return r.json();
}

export function getLogoutUrl() {
  return `${API_BASE}/auth/logout`;
}

export async function getLibrary(search = null, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  const r = await fetch(`${API_BASE}/api/library?${params}`, fetchOpts());
  if (!r.ok) throw new Error(r.status === 401 ? "Not logged in" : await r.text());
  return r.json();
}

export async function getDownloadPath() {
  const r = await fetch(`${API_BASE}/api/downloads/path`, fetchOpts());
  return r.json();
}

export async function startDownload(gameIds, includeBonus = true) {
  const r = await fetch(`${API_BASE}/api/download`, {
    ...fetchOpts(),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameIds,
      includeBonus,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Download failed");
  }
  return r.json();
}

export async function getDownloadStatus() {
  const r = await fetch(`${API_BASE}/api/downloads/status`, fetchOpts());
  return r.json();
}
