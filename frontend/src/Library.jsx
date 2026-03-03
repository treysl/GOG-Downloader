import { useState, useEffect, useCallback } from "react";
import {
  getLibrary,
  getDownloadPath,
  startDownload,
  getDownloadStatus,
  getLogoutUrl,
} from "./api";

function Library() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [downloadPath, setDownloadPath] = useState("");
  const [includeBonus, setIncludeBonus] = useState(true);
  const [status, setStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    getDownloadPath().then((data) => setDownloadPath(data.path || "/downloads"));
  }, []);

  useEffect(() => {
    if (!downloading) return;
    const t = setInterval(() => {
      getDownloadStatus().then((data) => {
        setStatus(data);
        if (data.status === "idle") setDownloading(false);
      });
    }, 1500);
    return () => clearInterval(t);
  }, [downloading]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(products.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());

  const doSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const onStartDownload = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) { setError("Select at least one game."); return; }
    setError("");
    setDownloading(true);
    setStatus({ status: "queued" });
    startDownload(ids, downloadPath, includeBonus).catch((e) => {
      setError(e.message);
      setDownloading(false);
    });
  };

  const formatBytes = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + " GB";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + " KB";
    return n + " B";
  };

  const pct = status?.bytes_total > 0
    ? Math.round((100 * status.bytes_done) / status.bytes_total)
    : 0;

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

      {/* ─── Main content ─── */}
      <main className="main-content" style={{
        maxWidth: 1280, width: "100%", margin: "0 auto",
        padding: "1.5rem 2rem", flex: 1,
      }}>

        {/* ─── Toolbar ─── */}
        <div role="search" style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1.25rem",
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
        </div>

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

          <label style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            fontSize: "0.85rem", color: "var(--gog-text-secondary)",
          }}>
            <svg aria-hidden="true" style={{
              width: 14, height: 14, fill: "none",
              stroke: "var(--gog-text-muted)", strokeWidth: 2,
            }} viewBox="0 0 24 24">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <input
              type="text"
              aria-label="Download path"
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.target.value)}
              style={{
                padding: "0.35rem 0.5rem",
                borderRadius: "var(--gog-radius-sm)",
                border: "1px solid var(--gog-border)",
                background: "var(--gog-bg-input)",
                color: "var(--gog-text)",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                width: 200,
              }}
            />
          </label>

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
            <button
              className="alert-dismiss"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {/* ─── Download progress ─── */}
        {status && (status.status === "downloading" || status.status === "queued") && (
          <div role="status" aria-live="polite" style={{
            padding: "1rem 1.25rem",
            background: "var(--gog-bg-card)",
            borderRadius: "var(--gog-radius)",
            border: "1px solid var(--gog-purple-dark)",
            marginBottom: "1.25rem",
            boxShadow: "0 0 20px rgba(126,77,210,0.08)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: status.bytes_total > 0 ? "0.75rem" : 0,
              flexWrap: "wrap", gap: "0.5rem",
            }}>
              <div>
                <span style={{
                  display: "inline-block",
                  padding: "0.15rem 0.5rem",
                  background: "var(--gog-purple)",
                  borderRadius: "var(--gog-radius-sm)",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginRight: "0.75rem",
                  color: "#fff",
                }}>
                  {status.status === "queued" ? "Queued" : "Downloading"}
                </span>
                {status.current_game_title && (
                  <span style={{ fontWeight: 700 }}>{status.current_game_title}</span>
                )}
              </div>
              {status.bytes_total > 0 && (
                <span style={{ color: "var(--gog-text-secondary)", fontSize: "0.85rem" }}>
                  {formatBytes(status.bytes_done)} / {formatBytes(status.bytes_total)} ({pct}%)
                </span>
              )}
            </div>
            {status.current_file && (
              <div style={{
                fontSize: "0.8rem", color: "var(--gog-text-muted)",
                marginBottom: "0.5rem", fontFamily: "monospace",
              }}>
                {status.current_file}
              </div>
            )}
            {status.bytes_total > 0 && (
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Download progress: ${pct}%`}
                style={{
                  height: 6, background: "var(--gog-bg-deep)",
                  borderRadius: 3, overflow: "hidden",
                }}
              >
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--gog-purple-dark), var(--gog-purple-light))",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }} />
              </div>
            )}
          </div>
        )}

        {/* ─── Completed downloads (only when job is finished) ─── */}
        {status?.completed?.length > 0 && status.status === "idle" && (
          <div role="status" style={{
            padding: "0.75rem 1rem",
            background: "var(--gog-green-bg)",
            border: "1px solid rgba(76,153,74,0.3)",
            borderRadius: "var(--gog-radius)",
            marginBottom: "1rem",
            fontSize: "0.85rem",
          }}>
            <strong>Completed:</strong>{" "}
            {status.completed.map((c) => c.title || c.file).join(", ")}
          </div>
        )}

        {/* ─── Failed downloads ─── */}
        {status?.failed?.length > 0 && (
          <div
            role="alert"
            style={{
              padding: "0.75rem 1rem",
              background: "var(--gog-red-bg)",
              border: "1px solid rgba(217,69,69,0.3)",
              borderRadius: "var(--gog-radius)",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            <strong>Failed:</strong>{" "}
            {status.failed
              .map((f) => {
                const name = f.file || f.game_id;
                const err = f.error ? ` (${f.error})` : "";
                return `${name}${err}`;
              })
              .join(", ")}
          </div>
        )}

        {/* ─── Loading skeleton ─── */}
        {loading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
          }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ borderRadius: "var(--gog-radius)", overflow: "hidden" }}>
                <div className="skeleton" style={{ aspectRatio: "3/4" }} />
                <div style={{
                  padding: "0.65rem 0.75rem",
                  background: "var(--gog-bg-card)",
                }}>
                  <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Game grid ─── */}
        {!loading && (
          <div
            role="grid"
            aria-label="Game library"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {products.map((p) => (
              <GameCard
                key={p.id}
                product={p}
                isSelected={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
              />
            ))}
          </div>
        )}

        {/* ─── Empty state ─── */}
        {!loading && products.length === 0 && (
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
              No games found
            </div>
            <div style={{ fontSize: "0.9rem" }}>
              {search ? "Try a different search term." : "Your library appears empty."}
            </div>
          </div>
        )}

        {/* ─── Pagination ─── */}
        {totalPages > 1 && (
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
    </div>
  );
}

function GameCard({ product, isSelected, onToggle }) {
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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
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
            position: "absolute",
            top: 8, right: 8,
            width: 24, height: 24,
            borderRadius: "50%",
            background: "var(--gog-purple)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}>
            <svg aria-hidden="true" style={{
              width: 14, height: 14, fill: "none",
              stroke: "#fff", strokeWidth: 2.5,
            }} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        )}
      </div>
      <div style={{
        padding: "0.65rem 0.75rem",
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
    </div>
  );
}

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

export default Library;
