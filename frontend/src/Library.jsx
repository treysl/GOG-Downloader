import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getLibrary,
  getDownloadPath,
  setDownloadPath,
  startDownload,
  getDownloadStatus,
  cancelDownload,
  getDownloadFiles,
  getLogoutUrl,
  getAllTags,
  createTagApi,
  updateTagApi,
  deleteTagApi,
  setGameTagsApi,
} from "./api";

const TAG_PALETTE = [
  "#7e4dd2","#4c994a","#d94545","#d97b45",
  "#4590d9","#d945b8","#45d9c8","#9b8a2a",
  "#a0a0a0","#5ca8d9","#c47c3e","#5a8a5a",
];

function Library() {
  // ── Library state ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [downloadBase, setDownloadBase] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [pathSaveStatus, setPathSaveStatus] = useState(""); // "" | "saving" | "saved" | error text
  const [includeBonus, setIncludeBonus] = useState(true);
  const [status, setStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Tags ───────────────────────────────────────────────────────────────────
  const [allTags, setAllTags] = useState({});         // {name: {color}}
  const [gameTags, setGameTags] = useState({});       // {productId: [name, ...]}
  const [filterTag, setFilterTag] = useState(null);   // active filter tag name or null
  const [filteredProducts, setFilteredProducts] = useState(null);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  // tagPicker: {productId, rect} while picker is open, null otherwise
  const [tagPicker, setTagPicker] = useState(null);
  const pickerRef = useRef(null);
  // ── Download folder browser ───────────────────────────────────────────────
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [filesPath, setFilesPath] = useState("");
  const [filesData, setFilesData] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");

  // ── Load library ───────────────────────────────────────────────────────────
  const loadLibrary = useCallback(() => {
    setError("");
    setLoading(true);
    getLibrary(search || undefined, page)
      .then((data) => {
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 1);
        setTotalProducts(data.totalProducts || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  useEffect(() => {
    getDownloadPath()
      .then((data) => {
        const p = data.path || "";
        setDownloadBase(p);
        setPathInput(p);
      })
      .catch(() => {});
  }, []);

  const loadFiles = useCallback((subpath) => {
    setFilesLoading(true);
    setFilesError("");
    getDownloadFiles(subpath || "")
      .then((data) => {
        setFilesData(data);
        setFilesPath(data.path || "");
      })
      .catch((e) => {
        setFilesError(e.message);
        setFilesData(null);
      })
      .finally(() => setFilesLoading(false));
  }, []);

  // ── Load tags ──────────────────────────────────────────────────────────────
  const loadTags = useCallback(() => {
    getAllTags()
      .then((data) => {
        setAllTags(data.tags || {});
        setGameTags(data.game_tags || {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  // ── Tag filter: load all pages when a tag filter is active ────────────────
  useEffect(() => {
    if (!filterTag) {
      setFilteredProducts(null);
      return;
    }
    const taggedIds = new Set(
      Object.entries(gameTags)
        .filter(([, tags]) => tags.includes(filterTag))
        .map(([id]) => Number(id))
    );
    if (taggedIds.size === 0) {
      setFilteredProducts([]);
      return;
    }
    setLoadingFilter(true);
    setFilteredProducts(null);
    const loadAll = async () => {
      const first = await getLibrary(undefined, 1);
      const all = [...first.products];
      if (first.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: first.totalPages - 1 }, (_, i) =>
            getLibrary(undefined, i + 2)
          )
        );
        rest.forEach((r) => all.push(...r.products));
      }
      setFilteredProducts(all.filter((p) => taggedIds.has(p.id)));
      setLoadingFilter(false);
    };
    loadAll().catch((e) => { setError(e.message); setLoadingFilter(false); });
  }, [filterTag, gameTags]);

  // ── Close tag picker when clicking outside ────────────────────────────────
  useEffect(() => {
    if (!tagPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setTagPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagPicker]);

  // ── Download status polling ────────────────────────────────────────────────
  useEffect(() => {
    if (!downloading) return;
    const t = setInterval(() => {
      getDownloadStatus().then((data) => {
        setStatus(data);
        if (data.status === "idle" || data.status === "cancelled") {
          setDownloading(false);
          setCancelling(false);
        }
      });
    }, 1500);
    return () => clearInterval(t);
  }, [downloading]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll  = () => setSelected(new Set((filterTag ? filteredProducts : products).map((p) => p.id)));
  const selectNone = () => setSelected(new Set());

  const doSearch = () => { setPage(1); setSearch(searchInput); setFilterTag(null); };

  const onTagFilter = (name) => setFilterTag((prev) => (prev === name ? null : name));

  const onSavePath = () => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;
    setPathSaveStatus("saving");
    setDownloadPath(trimmed)
      .then((data) => {
        const saved = data.path || trimmed;
        setDownloadBase(saved);
        setPathInput(saved);
        setPathSaveStatus("saved");
        setTimeout(() => setPathSaveStatus(""), 2000);
      })
      .catch((e) => {
        setPathSaveStatus(e.message || "Error saving path");
        setTimeout(() => setPathSaveStatus(""), 4000);
      });
  };

  const onStartDownload = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) { setError("Select at least one game."); return; }
    setError("");
    setCancelling(false);
    setDownloading(true);
    setStatus({ status: "queued" });
    startDownload(ids, includeBonus).catch((e) => { setError(e.message); setDownloading(false); });
  };

  const onCancelDownload = () => {
    setCancelling(true);
    cancelDownload().catch((e) => { setError(e.message); setCancelling(false); });
  };

  // ── Tag mutation handlers ─────────────────────────────────────────────────
  const handleCreateTag = (name, color) =>
    createTagApi(name, color).then((t) => {
      setAllTags((prev) => ({ ...prev, [t.name]: { color: t.color } }));
    });

  const handleUpdateTag = (oldName, newName, color) =>
    updateTagApi(oldName, { name: newName, color }).then((t) => {
      setAllTags((prev) => {
        const next = { ...prev };
        delete next[oldName];
        next[t.name] = { color: t.color };
        return next;
      });
      if (filterTag === oldName) setFilterTag(t.name);
      setGameTags((prev) => {
        const next = {};
        for (const [id, tags] of Object.entries(prev))
          next[id] = tags.map((tg) => (tg === oldName ? t.name : tg));
        return next;
      });
    });

  const handleDeleteTag = (name) =>
    deleteTagApi(name).then(() => {
      setAllTags((prev) => { const next = { ...prev }; delete next[name]; return next; });
      if (filterTag === name) setFilterTag(null);
      setGameTags((prev) => {
        const next = {};
        for (const [id, tags] of Object.entries(prev))
          next[id] = tags.filter((t) => t !== name);
        return next;
      });
    });

  const handleSetGameTags = (productId, tags) => {
    setGameTags((prev) => ({ ...prev, [String(productId)]: tags }));
    setGameTagsApi(productId, tags).catch((e) => {
      setError(e.message);
      loadTags();
    });
  };

  const handleTagBtnClick = (e, productId) => {
    e.stopPropagation();
    if (tagPicker?.productId === productId) { setTagPicker(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setTagPicker({ productId, rect });
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const displayProducts = filterTag ? (filteredProducts || []) : products;
  const displayLoading  = filterTag ? loadingFilter : loading;

  const formatBytes = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + " GB";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + " KB";
    return n + " B";
  };

  const pct = status?.bytes_total > 0
    ? Math.round((100 * status.bytes_done) / status.bytes_total)
    : 0;

  const hasTagsDefined = Object.keys(allTags).length > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ─── Top navbar ─── */}
      <nav className="nav-bar" role="banner" style={{
        background: "var(--gog-bg)",
        borderBottom: "1px solid var(--gog-border)",
        padding: "0 2rem",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: 1 }}>
            GOG<span style={{ fontWeight: 300, color: "var(--gog-text-secondary)", fontSize: "0.85rem" }}>.dl</span>
          </span>
          <span style={{
            color: "var(--gog-text-muted)",
            fontSize: "0.8rem",
            borderLeft: "1px solid var(--gog-border)",
            paddingLeft: "1rem",
          }}>
            {totalProducts} game{totalProducts !== 1 ? "s" : ""}
            {selected.size > 0 && (
              <span style={{ color: "var(--gog-purple-light)", marginLeft: "0.5rem" }}>
                ({selected.size} selected)
              </span>
            )}
          </span>
        </div>
        <a href={getLogoutUrl()} className="sign-out" style={{
          padding: "0.4rem 1rem",
          border: "1px solid var(--gog-border)",
          borderRadius: "var(--gog-radius)",
          color: "var(--gog-text-secondary)",
          fontSize: "0.85rem",
          transition: "all var(--gog-transition)",
        }}>
          Sign out
        </a>
      </nav>

      {/* ─── Body row: game grid + queue sidebar ─── */}
      <div style={{ display: "flex", flex: 1, alignItems: "flex-start" }}>
      <main className="main-content" style={{
        flex: 1, minWidth: 0,
        padding: "1.5rem 2rem",
      }}>

        {/* ─── Toolbar ─── */}
        <div role="search" style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1rem",
        }}>
          <div style={{ flex: "1 1 280px", position: "relative" }}>
            <svg aria-hidden="true" style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, fill: "none", stroke: "var(--gog-text-muted)", strokeWidth: 2,
            }} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              aria-label="Search your game library"
              placeholder="Search your library..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem 0.6rem 2.25rem",
                borderRadius: "var(--gog-radius)",
                border: "1px solid var(--gog-border)",
                background: "var(--gog-bg-card)",
                color: "var(--gog-text)",
                fontSize: "0.9rem",
              }}
            />
          </div>
          <ToolBtn onClick={doSearch}>Search</ToolBtn>

          <div style={{ width: 1, height: 28, background: "var(--gog-border)" }} />
          <ToolBtn onClick={selectAll}>Select all</ToolBtn>
          <ToolBtn onClick={selectNone}>Deselect all</ToolBtn>

          <div style={{ width: 1, height: 28, background: "var(--gog-border)" }} />
          {/* Tags button */}
          <ToolBtn onClick={() => setShowTagManager(true)}>
            <svg aria-hidden="true" style={{
              width: 13, height: 13, fill: "none",
              stroke: "currentColor", strokeWidth: 2,
              marginRight: "0.3rem", verticalAlign: "middle",
            }} viewBox="0 0 24 24">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Tags
          </ToolBtn>
        </div>

        {/* ─── Tag filter chips ─── */}
        {hasTagsDefined && (
          <div style={{
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}>
            <span style={{ fontSize: "0.75rem", color: "var(--gog-text-muted)", flexShrink: 0 }}>
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              style={{
                padding: "0.2rem 0.6rem",
                fontSize: "0.75rem",
                borderRadius: 999,
                border: "1px solid var(--gog-border)",
                background: filterTag === null ? "var(--gog-purple)" : "var(--gog-bg-card)",
                color: filterTag === null ? "#fff" : "var(--gog-text-secondary)",
                cursor: "pointer",
              }}
            >
              All
            </button>
            {Object.entries(allTags).map(([name, { color }]) => {
              const active = filterTag === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onTagFilter(name)}
                  style={{
                    padding: "0.2rem 0.65rem",
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    border: `1px solid ${active ? color : "var(--gog-border)"}`,
                    background: active ? color : "var(--gog-bg-card)",
                    color: active ? "#fff" : "var(--gog-text-secondary)",
                    cursor: "pointer",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {name}
                </button>
              );
            })}
            {filterTag && (
              <span style={{ fontSize: "0.72rem", color: "var(--gog-text-muted)", marginLeft: "0.25rem" }}>
                {loadingFilter
                  ? "Loading…"
                  : `${filteredProducts?.length ?? 0} game${filteredProducts?.length !== 1 ? "s" : ""}`
                }
              </span>
            )}
          </div>
        )}

        {/* ─── Download options bar ─── */}
        <div className="options-bar" style={{
          display: "flex",
          gap: "1.25rem",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          background: "var(--gog-bg-card)",
          borderRadius: "var(--gog-radius)",
          border: "1px solid var(--gog-border)",
        }}>
          <label style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            fontSize: "0.85rem", color: "var(--gog-text-secondary)", cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={includeBonus}
              onChange={(e) => setIncludeBonus(e.target.checked)}
            />
            Include bonus content
          </label>

          <div className="divider-v" style={{ width: 1, height: 24, background: "var(--gog-border)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--gog-text-secondary)",
              flexWrap: "wrap",
            }}>
              <svg aria-hidden="true" style={{
                width: 14, height: 14, fill: "none",
                stroke: "var(--gog-text-muted)", strokeWidth: 2, flexShrink: 0,
              }} viewBox="0 0 24 24">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ flexShrink: 0 }}>Save to:</span>
              <input
                type="text"
                value={pathInput}
                onChange={(e) => { setPathInput(e.target.value); setPathSaveStatus(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") onSavePath(); }}
                placeholder="C:\Users\...\Downloads\GOG"
                style={{
                  flex: "1 1 260px",
                  minWidth: 180,
                  padding: "0.3rem 0.55rem",
                  background: "var(--gog-bg-deep)",
                  color: "var(--gog-text)",
                  border: "1px solid var(--gog-border)",
                  borderRadius: "var(--gog-radius-sm)",
                  fontSize: "0.83rem",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={onSavePath}
                disabled={pathSaveStatus === "saving" || !pathInput.trim()}
                style={{
                  padding: "0.3rem 0.7rem",
                  fontSize: "0.8rem",
                  background: pathSaveStatus === "saved"
                    ? "var(--gog-green, #4c994a)"
                    : "var(--gog-purple)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--gog-radius-sm)",
                  cursor: pathSaveStatus === "saving" ? "wait" : "pointer",
                  flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                {pathSaveStatus === "saving" ? "Saving…" : pathSaveStatus === "saved" ? "Saved ✓" : "Save"}
              </button>
            </label>
            {pathSaveStatus && pathSaveStatus !== "saving" && pathSaveStatus !== "saved" && (
              <div style={{ fontSize: "0.75rem", color: "var(--gog-red)", marginLeft: "1.5rem" }}>
                {pathSaveStatus}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setShowFilesPanel((v) => !v);
                if (!showFilesPanel) {
                  setFilesPath("");
                  loadFiles("");
                }
              }}
              style={{
                alignSelf: "flex-start",
                padding: "0.3rem 0.6rem",
                fontSize: "0.75rem",
                background: "var(--gog-bg-deep)",
                color: "var(--gog-text-secondary)",
                border: "1px solid var(--gog-border)",
                borderRadius: "var(--gog-radius-sm)",
                cursor: "pointer",
              }}
            >
              {showFilesPanel ? "Hide" : "Browse"} downloaded files
            </button>
          </div>

          {showFilesPanel && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              background: "var(--gog-bg-deep)",
              border: "1px solid var(--gog-border)",
              borderRadius: "var(--gog-radius)",
              maxHeight: 320,
              overflow: "auto",
            }}>
              <div style={{ fontSize: "0.7rem", color: "var(--gog-text-muted)", marginBottom: "0.5rem" }}>
                Files on disk in <code>{downloadBase || "/downloads"}</code>
                {filesPath && (
                  <span>
                    {" "}/ <code>{filesPath}</code>
                  </span>
                )}
              </div>
              {filesLoading && <div style={{ color: "var(--gog-text-muted)", fontSize: "0.85rem" }}>Loading…</div>}
              {filesError && <div style={{ color: "var(--gog-red)", fontSize: "0.85rem" }}>{filesError}</div>}
              {!filesLoading && !filesError && filesData?.entries && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  {filesPath && (
                    <button
                      type="button"
                      onClick={() => {
                        const parent = filesPath.includes("/") ? filesPath.replace(/\/[^/]+$/, "") : "";
                        setFilesPath(parent);
                        loadFiles(parent);
                      }}
                      style={{
                        textAlign: "left",
                        padding: "0.3rem 0.5rem",
                        fontSize: "0.8rem",
                        background: "var(--gog-bg-card)",
                        color: "var(--gog-text-secondary)",
                        border: "1px solid var(--gog-border)",
                        borderRadius: "var(--gog-radius-sm)",
                        cursor: "pointer",
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  {filesData.entries.map((entry) => (
                    <div
                      key={entry.path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.3rem 0.5rem",
                        borderRadius: "var(--gog-radius-sm)",
                        background: entry.isDir ? "rgba(126,77,210,0.08)" : "transparent",
                        cursor: entry.isDir ? "pointer" : "default",
                      }}
                      onClick={() => { if (entry.isDir) { setFilesPath(entry.path); loadFiles(entry.path); } }}
                      onKeyDown={(e) => { if (entry.isDir && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setFilesPath(entry.path); loadFiles(entry.path); } }}
                      role={entry.isDir ? "button" : "none"}
                      tabIndex={entry.isDir ? 0 : undefined}
                    >
                      <span style={{ fontSize: "0.85rem" }}>{entry.isDir ? "📁" : "📄"}</span>
                      <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--gog-text)" }}>{entry.name}</span>
                      {!entry.isDir && entry.size != null && (
                        <span style={{ fontSize: "0.75rem", color: "var(--gog-text-muted)" }}>
                          {formatBytes(entry.size)}
                        </span>
                      )}
                    </div>
                  ))}
                  {filesData.entries.length === 0 && !filesPath && (
                    <div style={{ fontSize: "0.8rem", color: "var(--gog-text-muted)" }}>
                      Folder is empty. Download games to see files here.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="spacer" style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onStartDownload}
            disabled={selected.size === 0 || downloading}
            aria-label={`Download ${selected.size} selected games`}
            style={{
              padding: "0.6rem 1.5rem",
              background: selected.size && !downloading
                ? "linear-gradient(135deg, var(--gog-green) 0%, #3a7a38 100%)"
                : "var(--gog-border)",
              color: selected.size && !downloading ? "#fff" : "var(--gog-text-muted)",
              border: "none",
              borderRadius: "var(--gog-radius)",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: selected.size && !downloading ? "pointer" : "not-allowed",
              letterSpacing: "0.02em",
            }}
          >
            Download {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div role="alert" aria-live="assertive" style={{
            background: "var(--gog-red-bg)",
            border: "1px solid rgba(217,69,69,0.3)",
            borderRadius: "var(--gog-radius)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            color: "#f08080",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span>{error}</span>
            <button className="alert-dismiss" onClick={() => setError("")} aria-label="Dismiss error">
              &times;
            </button>
          </div>
        )}

        {/* ─── Loading skeleton ─── */}
        {displayLoading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
          }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ borderRadius: "var(--gog-radius)", overflow: "hidden" }}>
                <div className="skeleton" style={{ aspectRatio: "3/4" }} />
                <div style={{ padding: "0.65rem 0.75rem", background: "var(--gog-bg-card)" }}>
                  <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Game grid ─── */}
        {!displayLoading && (
          <div
            role="grid"
            aria-label="Game library"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {displayProducts.map((p) => (
              <GameCard
                key={p.id}
                product={p}
                isSelected={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
                allTags={allTags}
                assignedTags={gameTags[String(p.id)] || []}
                onTagBtnClick={(e) => handleTagBtnClick(e, p.id)}
                activeTagPicker={tagPicker?.productId === p.id}
              />
            ))}
          </div>
        )}

        {/* ─── Empty state ─── */}
        {!displayLoading && displayProducts.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "var(--gog-text-muted)",
          }}>
            <svg aria-hidden="true" style={{
              width: 48, height: 48, fill: "none",
              stroke: "var(--gog-border)", strokeWidth: 1.5,
              marginBottom: "1rem",
            }} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontWeight: 700, color: "var(--gog-text-secondary)" }}>
              {filterTag ? `No games tagged "${filterTag}"` : "No games found"}
            </div>
            <div style={{ fontSize: "0.9rem" }}>
              {filterTag
                ? "Assign this tag to games using the tag button on each card."
                : search ? "Try a different search term." : "Your library appears empty."
              }
            </div>
          </div>
        )}

        {/* ─── Pagination (hidden when tag filter is active) ─── */}
        {!filterTag && totalPages > 1 && (
          <nav aria-label="Library pagination" style={{
            marginTop: "2rem",
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <PagBtn
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              label="Previous page"
            >
              <svg aria-hidden="true" style={{
                width: 16, height: 16, fill: "none",
                stroke: "currentColor", strokeWidth: 2,
              }} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
            </PagBtn>
            {buildPageNumbers(page, totalPages).map((pg, i) =>
              pg === null ? (
                <span key={`ellipsis-${i}`} style={{
                  color: "var(--gog-text-muted)",
                  padding: "0 0.25rem",
                  userSelect: "none",
                }}>...</span>
              ) : (
                <PagBtn
                  key={pg}
                  active={pg === page}
                  onClick={() => setPage(pg)}
                  label={`Page ${pg}`}
                >
                  {pg}
                </PagBtn>
              )
            )}
            <PagBtn
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              label="Next page"
            >
              <svg aria-hidden="true" style={{
                width: 16, height: 16, fill: "none",
                stroke: "currentColor", strokeWidth: 2,
              }} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
            </PagBtn>
          </nav>
        )}
      </main>
      <QueueSidebar
        status={status}
        formatBytes={formatBytes}
        downloading={downloading}
        cancelling={cancelling}
        onCancel={onCancelDownload}
      />
      </div>

      {/* ─── Footer ─── */}
      <footer style={{
        textAlign: "center",
        padding: "1.5rem",
        borderTop: "1px solid var(--gog-border)",
        color: "var(--gog-text-muted)",
        fontSize: "0.75rem",
      }}>
        GOG Offline Library Downloader &mdash; Not affiliated with GOG or CD PROJEKT
      </footer>

      {/* ─── Tag picker (fixed overlay, rendered in Library so it escapes card overflow) ─── */}
      {tagPicker && (
        <TagPicker
          ref={pickerRef}
          productId={tagPicker.productId}
          anchorRect={tagPicker.rect}
          allTags={allTags}
          assignedTags={gameTags[String(tagPicker.productId)] || []}
          onUpdate={(tags) => handleSetGameTags(tagPicker.productId, tags)}
          onClose={() => setTagPicker(null)}
        />
      )}

      {/* ─── Tag manager modal ─── */}
      {showTagManager && (
        <TagManager
          allTags={allTags}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          onClose={() => setShowTagManager(false)}
          setError={setError}
        />
      )}
    </div>
  );
}

// ── GameCard ──────────────────────────────────────────────────────────────────

function GameCard({ product, isSelected, onToggle, allTags, assignedTags, onTagBtnClick, activeTagPicker }) {
  const hasTagsDefined = Object.keys(allTags).length > 0;
  return (
    <div
      className="game-card"
      role="gridcell"
      onClick={onToggle}
      style={{
        background: "var(--gog-bg-card)",
        borderRadius: "var(--gog-radius)",
        overflow: "hidden",
        cursor: "pointer",
        border: isSelected
          ? "2px solid var(--gog-purple)"
          : "2px solid transparent",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{
        aspectRatio: "3/4",
        background: "var(--gog-bg-deep)",
        position: "relative",
        overflow: "hidden",
      }}>
        {product.image ? (
          <img
            className="game-card-img"
            src={product.image}
            alt={product.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: "0.5rem",
            color: "var(--gog-text-muted)",
          }}>
            <svg aria-hidden="true" style={{
              width: 32, height: 32, fill: "none",
              stroke: "var(--gog-border)", strokeWidth: 1.5,
            }} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: "0.7rem" }}>No image</span>
          </div>
        )}
        {isSelected && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 24, height: 24,
            borderRadius: "50%",
            background: "var(--gog-purple)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}>
            <svg aria-hidden="true" style={{
              width: 14, height: 14, fill: "none",
              stroke: "#fff", strokeWidth: 2.5,
            }} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        )}
      </div>

      {/* Title row */}
      <div style={{
        padding: "0.6rem 0.75rem 0.35rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${product.title}`}
        />
        <span
          title={product.title}
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
        >
          {product.title}
        </span>
      </div>

      {/* Tag chips row */}
      <div style={{
        padding: "0 0.65rem 0.55rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.25rem",
        alignItems: "center",
        minHeight: hasTagsDefined ? 24 : 0,
      }}>
        {assignedTags.map((tag) => (
          <span key={tag} style={{
            display: "inline-block",
            padding: "0.1rem 0.45rem",
            borderRadius: 999,
            fontSize: "0.65rem",
            fontWeight: 700,
            background: allTags[tag]?.color || "var(--gog-purple)",
            color: "#fff",
            whiteSpace: "nowrap",
          }}>
            {tag}
          </span>
        ))}
        {hasTagsDefined && (
          <button
            type="button"
            onClick={onTagBtnClick}
            aria-label="Edit tags"
            style={{
              width: 18, height: 18,
              borderRadius: "50%",
              border: `1px solid ${activeTagPicker ? "var(--gog-purple-light)" : "var(--gog-border)"}`,
              background: activeTagPicker ? "var(--gog-purple)" : "transparent",
              color: activeTagPicker ? "#fff" : "var(--gog-text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.7rem",
              lineHeight: 1,
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

// ── TagPicker ─────────────────────────────────────────────────────────────────
// Floating panel anchored near a game card's tag button.

const TagPicker = React.forwardRef(({ productId, anchorRect, allTags, assignedTags, onUpdate, onClose }, ref) => {
  const assigned = new Set(assignedTags);

  const toggle = (name) => {
    const next = new Set(assigned);
    if (next.has(name)) next.delete(name); else next.add(name);
    onUpdate(Array.from(next));
  };

  // Position: prefer below the anchor, flip up if near bottom of viewport
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const panelHeight = 200;
  const top = spaceBelow > panelHeight
    ? anchorRect.bottom + window.scrollY + 4
    : anchorRect.top + window.scrollY - panelHeight - 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 210);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top,
        left,
        zIndex: 500,
        width: 200,
        background: "var(--gog-bg-card)",
        border: "1px solid var(--gog-border)",
        borderRadius: "var(--gog-radius)",
        boxShadow: "var(--gog-shadow-lg)",
        padding: "0.5rem",
      }}
    >
      <div style={{
        fontSize: "0.7rem", color: "var(--gog-text-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: "0.4rem", padding: "0 0.25rem",
      }}>
        Assign tags
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem", maxHeight: 160, overflowY: "auto" }}>
        {Object.entries(allTags).map(([name, { color }]) => {
          const active = assigned.has(name);
          return (
            <label key={name} style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.3rem 0.4rem",
              borderRadius: "var(--gog-radius-sm)",
              cursor: "pointer",
              background: active ? "rgba(126,77,210,0.12)" : "transparent",
            }}>
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(name)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 14, height: 14 }}
              />
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: color, flexShrink: 0,
              }} />
              <span style={{ fontSize: "0.8rem", color: "var(--gog-text)" }}>{name}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: "0.4rem",
          width: "100%",
          padding: "0.3rem",
          fontSize: "0.75rem",
          background: "var(--gog-bg-deep)",
          color: "var(--gog-text-muted)",
          border: "1px solid var(--gog-border)",
          borderRadius: "var(--gog-radius-sm)",
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  );
});

// ── TagManager ────────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
      {TAG_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22,
            borderRadius: "50%",
            background: c,
            border: value === c ? "2px solid #fff" : "2px solid transparent",
            boxShadow: value === c ? `0 0 0 2px ${c}` : "none",
            padding: 0, cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

function TagManager({ allTags, onCreateTag, onUpdateTag, onDeleteTag, onClose, setError }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_PALETTE[0]);
  const [editTag, setEditTag] = useState(null);   // name being edited
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [busy, setBusy] = useState(false);

  const doCreate = () => {
    if (!newName.trim()) return;
    setBusy(true);
    onCreateTag(newName.trim(), newColor)
      .then(() => { setNewName(""); setNewColor(TAG_PALETTE[0]); })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const doSaveEdit = () => {
    if (!editName.trim()) return;
    setBusy(true);
    onUpdateTag(editTag, editName.trim(), editColor)
      .then(() => setEditTag(null))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const doDelete = (name) => {
    if (!window.confirm(`Delete tag "${name}"? It will be removed from all games.`)) return;
    onDeleteTag(name).catch((e) => setError(e.message));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Tags"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--gog-bg-card)",
        borderRadius: "var(--gog-radius-lg)",
        border: "1px solid var(--gog-border)",
        padding: "1.5rem",
        width: "min(460px, 92vw)",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "var(--gog-shadow-lg)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1.25rem",
        }}>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>Manage Tags</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: "var(--gog-text-muted)", fontSize: "1.3rem",
              lineHeight: 1, cursor: "pointer", padding: "0 0.25rem",
            }}
          >
            &times;
          </button>
        </div>

        {/* Existing tags */}
        {Object.keys(allTags).length === 0 ? (
          <div style={{
            color: "var(--gog-text-muted)", fontSize: "0.85rem",
            padding: "1rem 0", textAlign: "center",
          }}>
            No tags yet. Create one below.
          </div>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: "0.5rem",
            marginBottom: "1.25rem",
          }}>
            {Object.entries(allTags).map(([name, { color }]) =>
              editTag === name ? (
                <div key={name} style={{
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                  padding: "0.75rem",
                  background: "var(--gog-bg-deep)",
                  borderRadius: "var(--gog-radius)",
                  border: "1px solid var(--gog-border)",
                }}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSaveEdit()}
                    autoFocus
                    style={{
                      padding: "0.4rem 0.6rem",
                      background: "var(--gog-bg-card)",
                      border: "1px solid var(--gog-border)",
                      borderRadius: "var(--gog-radius-sm)",
                      color: "var(--gog-text)",
                      fontSize: "0.85rem",
                    }}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={doSaveEdit} disabled={busy} style={btnStyle("#4c994a")}>Save</button>
                    <button type="button" onClick={() => setEditTag(null)} style={btnStyle("var(--gog-border)")}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.5rem 0.75rem",
                  background: "var(--gog-bg-deep)",
                  borderRadius: "var(--gog-radius)",
                }}>
                  <span style={{
                    display: "inline-block",
                    padding: "0.15rem 0.6rem",
                    borderRadius: 999,
                    background: color,
                    color: "#fff",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    flex: 1,
                  }}>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditTag(name); setEditName(name); setEditColor(color); }}
                    style={{ ...smallBtn, color: "var(--gog-text-secondary)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => doDelete(name)}
                    style={{ ...smallBtn, color: "#f08080" }}
                  >
                    Delete
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Create new tag */}
        <div style={{
          borderTop: "1px solid var(--gog-border)",
          paddingTop: "1rem",
        }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.6rem", color: "var(--gog-text-secondary)" }}>
            New tag
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <input
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
              style={{
                padding: "0.4rem 0.6rem",
                background: "var(--gog-bg-deep)",
                border: "1px solid var(--gog-border)",
                borderRadius: "var(--gog-radius-sm)",
                color: "var(--gog-text)",
                fontSize: "0.85rem",
              }}
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <button
              type="button"
              onClick={doCreate}
              disabled={!newName.trim() || busy}
              style={btnStyle(newName.trim() ? "var(--gog-purple)" : "var(--gog-border)")}
            >
              Create tag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const smallBtn = {
  background: "none",
  border: "none",
  fontSize: "0.78rem",
  cursor: "pointer",
  padding: "0.2rem 0.35rem",
  borderRadius: "var(--gog-radius-sm)",
};

const btnStyle = (bg) => ({
  padding: "0.4rem 1rem",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "var(--gog-radius-sm)",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
});

// ── Small reusable UI components ──────────────────────────────────────────────

function ToolBtn({ onClick, children }) {
  return (
    <button
      type="button"
      className="tool-btn"
      onClick={onClick}
      style={{
        padding: "0.55rem 1rem",
        background: "var(--gog-bg-card)",
        color: "var(--gog-text-secondary)",
        border: "1px solid var(--gog-border)",
        borderRadius: "var(--gog-radius)",
        fontSize: "0.85rem",
        fontWeight: 400,
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}

function PagBtn({ onClick, disabled, active, label, children }) {
  return (
    <button
      type="button"
      className={`pag-btn${active ? " pag-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        minWidth: 36, height: 36,
        padding: "0 0.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--gog-purple)" : "var(--gog-bg-card)",
        color: active ? "#fff" : disabled ? "var(--gog-text-muted)" : "var(--gog-text-secondary)",
        border: active ? "none" : "1px solid var(--gog-border)",
        borderRadius: "var(--gog-radius)",
        fontSize: "0.85rem",
        fontWeight: active ? 700 : 400,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push(null);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}

// ── Queue sidebar ─────────────────────────────────────────────────────────────

function buildQueueGroups(status) {
  const groups = [];

  const prevMap = new Map();
  for (const c of (status.completed || [])) {
    if (c.game_id !== status.current_game_id) {
      if (!prevMap.has(c.game_id)) prevMap.set(c.game_id, { title: c.title, done: 0, failed: 0 });
      prevMap.get(c.game_id).done++;
    }
  }
  for (const f of (status.failed || [])) {
    if (f.game_id !== status.current_game_id) {
      if (!prevMap.has(f.game_id)) prevMap.set(f.game_id, { title: `Game ${f.game_id}`, done: 0, failed: 0 });
      prevMap.get(f.game_id).failed++;
    }
  }
  for (const [id, g] of prevMap.entries()) {
    groups.push({ game_id: id, game_title: g.title, kind: "done", done: g.done, failed: g.failed, files: [] });
  }

  if (status.current_game_title) {
    const curDone    = (status.completed || []).filter(c => c.game_id === status.current_game_id);
    const curFailed  = (status.failed    || []).filter(f => f.game_id === status.current_game_id);
    const curPending = (status.queue     || []).filter(q => q.game_id === status.current_game_id);
    groups.push({
      game_id:    status.current_game_id,
      game_title: status.current_game_title,
      kind: "active",
      files: [
        ...curDone.map(c   => ({ filename: c.file,    state: "done"    })),
        ...curFailed.map(f => ({ filename: f.file,    state: "failed", error: f.error })),
        ...(status.current_file ? [{ filename: status.current_file, state: "active" }] : []),
        ...curPending.map(q => ({ filename: q.filename, state: "pending" })),
      ],
    });
  }

  const seen = new Set();
  for (const item of (status.queue || [])) {
    if (item.game_id === status.current_game_id) continue;
    if (!seen.has(item.game_id)) {
      seen.add(item.game_id);
      groups.push({ game_id: item.game_id, game_title: item.game_title, kind: "pending", files: [] });
    }
    const g = groups.find(x => x.game_id === item.game_id && x.kind === "pending");
    if (g) g.files.push({ filename: item.filename, state: "pending" });
  }

  return groups;
}

function QueueSidebar({ status, formatBytes, downloading, cancelling, onCancel }) {
  if (!status) return null;
  const isActive    = status.status === "downloading" || status.status === "queued";
  const isCancelled = status.status === "cancelled";
  const hasHistory  = (status.completed?.length > 0) || (status.failed?.length > 0);
  if (!isActive && !isCancelled && !hasHistory) return null;

  const pct    = status.bytes_total > 0 ? Math.round(100 * status.bytes_done / status.bytes_total) : 0;
  const groups = buildQueueGroups(status);

  return (
    <aside aria-label="Download queue" className="queue-sidebar">
      <div style={{ padding: "1rem 0.875rem" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--gog-border)",
        }}>
          <svg aria-hidden="true" style={{
            width: 14, height: 14, fill: "none",
            stroke: "var(--gog-text-muted)", strokeWidth: 2, flexShrink: 0,
          }} viewBox="0 0 24 24">
            <line x1="8" y1="6"  x2="21" y2="6"  />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6"  x2="3.01" y2="6"  />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Download Queue</span>

          {isActive && !cancelling && (
            <span
              className="queue-dot-pulse"
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: status.status === "downloading" ? "var(--gog-green)" : "var(--gog-purple)",
                flexShrink: 0,
              }}
            />
          )}

          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            {downloading && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                aria-label="Cancel download"
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  background: cancelling ? "var(--gog-bg-deep)" : "var(--gog-red-bg)",
                  color: cancelling ? "var(--gog-text-muted)" : "#f08080",
                  border: `1px solid ${cancelling ? "var(--gog-border)" : "rgba(217,69,69,0.4)"}`,
                  borderRadius: "var(--gog-radius-sm)",
                  cursor: cancelling ? "not-allowed" : "pointer",
                  transition: "all var(--gog-transition)",
                }}
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            )}
            {!downloading && isCancelled && (
              <span style={{
                fontSize: "0.68rem", color: "#f08080",
                padding: "0.1rem 0.4rem",
                background: "var(--gog-red-bg)",
                borderRadius: "var(--gog-radius-sm)",
              }}>Cancelled</span>
            )}
            {!downloading && !isCancelled && hasHistory && (
              <span style={{
                fontSize: "0.68rem", color: "var(--gog-green)",
                padding: "0.1rem 0.4rem",
                background: "var(--gog-green-bg)",
                borderRadius: "var(--gog-radius-sm)",
              }}>Done</span>
            )}
          </div>
        </div>

        {/* Active file progress bar */}
        {status.status === "downloading" && status.bytes_total > 0 && (
          <div style={{
            marginBottom: "1rem",
            padding: "0.6rem 0.75rem",
            background: "var(--gog-bg-deep)",
            borderRadius: "var(--gog-radius)",
            border: "1px solid var(--gog-border)",
          }}>
            <div style={{
              fontSize: "0.7rem", fontFamily: "monospace",
              color: "var(--gog-text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: "0.35rem",
            }}>
              {status.current_file || ""}
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
              aria-label={`Download progress: ${pct}%`}
              style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}
            >
              <div style={{
                height: "100%", width: `${pct}%`,
                background: "linear-gradient(90deg, var(--gog-purple-dark), var(--gog-purple-light))",
                borderRadius: 2, transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: "0.7rem", color: "var(--gog-text-muted)", marginTop: "0.25rem",
            }}>
              <span>{formatBytes(status.bytes_done)} / {formatBytes(status.bytes_total)}</span>
              <span>{pct}%</span>
            </div>
          </div>
        )}

        {/* Game groups */}
        {groups.map((group) => (
          <GameQueueGroup key={`${group.game_id}-${group.kind}`} group={group} />
        ))}

        {/* Cancelled message */}
        {!isActive && isCancelled && (
          <div style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "var(--gog-red-bg)",
            border: "1px solid rgba(217,69,69,0.3)",
            borderRadius: "var(--gog-radius)",
            fontSize: "0.8rem", color: "#f08080",
          }}>
            Download cancelled
            {hasHistory && " — files downloaded before cancellation were kept"}
          </div>
        )}
        {!isActive && !isCancelled && hasHistory && (
          <div style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "var(--gog-green-bg)",
            border: "1px solid rgba(76,153,74,0.3)",
            borderRadius: "var(--gog-radius)",
            fontSize: "0.8rem", color: "var(--gog-green)",
          }}>
            All downloads finished
          </div>
        )}
      </div>
    </aside>
  );
}

function GameQueueGroup({ group }) {
  const isDone    = group.kind === "done";
  const isActive  = group.kind === "active";
  const markerColor = isActive ? "var(--gog-purple-light)"
    : isDone ? "var(--gog-green)" : "var(--gog-border)";
  const marker = isActive ? "▶" : isDone ? "✓" : "○";

  return (
    <div style={{ marginBottom: "0.875rem", opacity: isDone ? 0.65 : 1 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.35rem",
        marginBottom: "0.35rem",
        paddingBottom: "0.3rem",
        borderBottom: "1px solid var(--gog-border)",
      }}>
        <span style={{ color: markerColor, fontSize: "0.6rem", flexShrink: 0, lineHeight: 1 }}>
          {marker}
        </span>
        <span style={{
          fontSize: "0.78rem", fontWeight: 700,
          color: isActive ? "var(--gog-text)" : isDone ? "var(--gog-text-muted)" : "var(--gog-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {group.game_title}
        </span>
        {isDone && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: "0.68rem", color: "var(--gog-text-muted)" }}>
            {group.done > 0 && <span style={{ color: "var(--gog-green)" }}>{group.done}✓</span>}
            {group.done > 0 && group.failed > 0 && " "}
            {group.failed > 0 && <span style={{ color: "#f08080" }}>{group.failed}✗</span>}
          </span>
        )}
      </div>

      {!isDone && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", paddingLeft: "0.65rem" }}>
          {group.files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span style={{
                flexShrink: 0, marginTop: "0.12em", fontSize: "0.65rem", lineHeight: 1,
                color: f.state === "done"    ? "var(--gog-green)"
                     : f.state === "failed"  ? "#f08080"
                     : f.state === "active"  ? "var(--gog-purple-light)"
                     : "var(--gog-border)",
              }}>
                {f.state === "done" ? "✓" : f.state === "failed" ? "✗" : f.state === "active" ? "▶" : "○"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: "0.73rem", fontFamily: "monospace",
                  lineHeight: 1.4, wordBreak: "break-all",
                  fontWeight: f.state === "active" ? 700 : 400,
                  color: f.state === "done"    ? "var(--gog-text-muted)"
                       : f.state === "failed"  ? "#f08080"
                       : f.state === "active"  ? "var(--gog-text)"
                       : "var(--gog-text-muted)",
                }}>
                  {f.filename}
                </div>
                {f.state === "failed" && f.error && (
                  <div style={{
                    fontSize: "0.68rem", color: "#f08080", opacity: 0.8,
                    marginTop: "0.1rem", lineHeight: 1.3, wordBreak: "break-word",
                  }}>
                    {f.error.length > 80 ? f.error.slice(0, 80) + "…" : f.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Library;
