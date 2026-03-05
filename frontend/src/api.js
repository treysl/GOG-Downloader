const API_BASE = "";

function fetchOpts(extra = {}) {
  return { credentials: "include", ...extra };
}

export async function getAuthStatus() {
  const r = await fetch(`${API_BASE}/auth/status`, fetchOpts());
  if (!r.ok) throw new Error(r.status === 401 ? "Not logged in" : await r.text());
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
  if (!r.ok) throw new Error(r.status === 401 ? "Not logged in" : await r.text());
  return r.json();
}

export async function setDownloadPath(path) {
  const r = await fetch(`${API_BASE}/api/downloads/path`, {
    ...fetchOpts(),
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Failed to update download path");
  }
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
  if (!r.ok) throw new Error(r.status === 401 ? "Not logged in" : await r.text());
  return r.json();
}

export async function getDownloadFiles(subpath = "") {
  const url = subpath
    ? `${API_BASE}/api/downloads/files?path=${encodeURIComponent(subpath)}`
    : `${API_BASE}/api/downloads/files`;
  const r = await fetch(url, fetchOpts());
  if (!r.ok) throw new Error(r.status === 401 ? "Not logged in" : await r.text());
  return r.json();
}

// ── Tag API ──────────────────────────────────────────────────────────────────

export async function getAllTags() {
  const r = await fetch(`${API_BASE}/api/tags`, fetchOpts());
  if (!r.ok) throw new Error("Failed to load tags");
  return r.json();
}

export async function createTagApi(name, color) {
  const r = await fetch(`${API_BASE}/api/tags`, {
    ...fetchOpts(),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Failed to create tag");
  }
  return r.json();
}

export async function updateTagApi(name, updates) {
  const r = await fetch(`${API_BASE}/api/tags/${encodeURIComponent(name)}`, {
    ...fetchOpts(),
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Failed to update tag");
  }
  return r.json();
}

export async function deleteTagApi(name) {
  const r = await fetch(`${API_BASE}/api/tags/${encodeURIComponent(name)}`, {
    ...fetchOpts(),
    method: "DELETE",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Failed to delete tag");
  }
}

export async function setGameTagsApi(productId, tags) {
  const r = await fetch(`${API_BASE}/api/games/${productId}/tags`, {
    ...fetchOpts(),
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Failed to update game tags");
  }
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────

export async function cancelDownload() {
  const r = await fetch(`${API_BASE}/api/downloads/cancel`, {
    ...fetchOpts(),
    method: "POST",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || "Cancel failed");
  }
  return r.json();
}
