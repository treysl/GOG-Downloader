import { useState, useEffect, useCallback } from "react";
import { getAuthStatus, getManualLoginUrl, completeManualLogin } from "./api";
import Library from "./Library";

const GOG_LOGO = (
  <svg viewBox="0 0 200 60" width="130" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="44" fontFamily="Lato, sans-serif" fontWeight="900" fontSize="42" fill="#e8e8e8"
      letterSpacing="2">GOG</text>
    <text x="132" y="44" fontFamily="Lato, sans-serif" fontWeight="300" fontSize="18" fill="#9b9b9b">.dl</text>
  </svg>
);

function App() {
  const [loggedIn, setLoggedIn] = useState(null);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setError(decodeURIComponent(err.replace(/\+/g, " ")));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    getAuthStatus()
      .then((data) => setLoggedIn(data.logged_in))
      .catch(() => setLoggedIn(false));
  }, []);

  const submitLogin = useCallback(async (raw) => {
    const value = (raw || "").trim();
    if (!value) return;
    setError("");
    setSubmitting(true);
    try {
      await completeManualLogin({ url: value });
      setLoggedIn(true);
    } catch (e) {
      setError(e.message || "Manual login failed");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handlePaste = useCallback((e) => {
    const text = e.clipboardData.getData("text");
    if (text && (text.includes("code=") || text.includes("on_login_success"))) {
      e.preventDefault();
      setPastedUrl(text.trim());
      submitLogin(text);
    }
  }, [submitLogin]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedUrl(text.trim());
        submitLogin(text);
      } else {
        setError("Clipboard is empty. Copy the URL first.");
      }
    } catch {
      setError("Clipboard access denied. Paste manually with Cmd+V / Ctrl+V into the box below.");
    }
  }, [submitLogin]);

  if (loggedIn === null) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div
          role="status"
          aria-label="Loading"
          style={{
            width: 40, height: 40,
            border: "3px solid var(--gog-border)",
            borderTopColor: "var(--gog-purple)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "radial-gradient(ellipse at 50% 0%, #1e1535 0%, var(--gog-bg-deep) 70%)",
      }}>
        <div style={{ marginBottom: "2rem" }}>{GOG_LOGO}</div>
        <h1 style={{
          margin: "0 0 0.25rem",
          fontSize: "1.6rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}>
          Offline Library Downloader
        </h1>
        <p style={{
          color: "var(--gog-text-secondary)",
          marginBottom: "2rem",
          fontSize: "0.95rem",
        }}>
          Sign in with your GOG account to download your games DRM-free.
        </p>

        {error && (
          <div role="alert" aria-live="assertive" style={{
            background: "var(--gog-red-bg)",
            border: "1px solid rgba(217,69,69,0.3)",
            borderRadius: "var(--gog-radius)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            maxWidth: 480,
            width: "100%",
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

        <div style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--gog-bg-card)",
          padding: "1.75rem",
          borderRadius: "var(--gog-radius-lg)",
          boxShadow: "var(--gog-shadow-lg)",
          border: "1px solid var(--gog-border)",
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            color: "var(--gog-text-secondary)",
          }}>
            <Step n={1}>Click <strong style={{ color: "var(--gog-text)" }}>Open GOG login</strong> to sign in via a new tab.</Step>
            <Step n={2}>Log in with your GOG credentials.</Step>
            <Step n={3}>
              After login, copy the URL from the blank page
              (<kbd>Cmd+L</kbd> <kbd>Cmd+C</kbd>).
            </Step>
            <Step n={4}>Come back here and click <strong style={{ color: "var(--gog-text)" }}>Paste URL &amp; Login</strong>.</Step>
          </div>

          <button
            type="button"
            disabled={loggingIn}
            onClick={async () => {
              setError("");
              setLoggingIn(true);
              try {
                const data = await getManualLoginUrl();
                setManualUrl(data.url);
                window.open(data.url, "_blank", "noopener,noreferrer");
              } catch (e) {
                setError(e.message || "Failed to get login URL");
              } finally {
                setLoggingIn(false);
              }
            }}
            style={{
              width: "100%",
              padding: "0.85rem",
              fontSize: "1rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, var(--gog-purple) 0%, var(--gog-purple-dark) 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--gog-radius)",
              cursor: loggingIn ? "wait" : "pointer",
              marginBottom: manualUrl ? "1.25rem" : 0,
              letterSpacing: "0.02em",
            }}
          >
            {loggingIn ? "Opening..." : "Open GOG login"}
          </button>

          {manualUrl && (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handlePasteFromClipboard}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  background: submitting
                    ? "var(--gog-border)"
                    : "linear-gradient(135deg, var(--gog-green) 0%, #3a7a38 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--gog-radius)",
                  cursor: submitting ? "wait" : "pointer",
                  marginBottom: "1rem",
                  letterSpacing: "0.02em",
                }}
              >
                {submitting ? "Logging in..." : "Paste URL & Login"}
              </button>

              <div style={{
                borderTop: "1px solid var(--gog-border)",
                paddingTop: "1rem",
              }}>
                <div style={{
                  marginBottom: "0.5rem",
                  fontSize: "0.8rem",
                  color: "var(--gog-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}>
                  Or paste manually
                </div>
                <textarea
                  rows={2}
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  onPaste={handlePaste}
                  aria-label="Paste GOG redirect URL"
                  placeholder="https://embed.gog.com/on_login_success?origin=client&code=..."
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "var(--gog-radius)",
                    border: "1px solid var(--gog-border)",
                    background: "var(--gog-bg-input)",
                    color: "var(--gog-text)",
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    marginBottom: "0.5rem",
                    boxSizing: "border-box",
                    resize: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={submitting || !pastedUrl.trim()}
                  onClick={() => submitLogin(pastedUrl)}
                  style={{
                    padding: "0.5rem 1.25rem",
                    background: !submitting && pastedUrl.trim() ? "var(--gog-border)" : "var(--gog-bg)",
                    color: !submitting && pastedUrl.trim() ? "var(--gog-text)" : "var(--gog-text-muted)",
                    border: "1px solid var(--gog-border)",
                    borderRadius: "var(--gog-radius)",
                    cursor: !submitting && pastedUrl.trim() ? "pointer" : "not-allowed",
                    fontSize: "0.85rem",
                  }}
                >
                  Submit
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{
          marginTop: "2rem",
          fontSize: "0.75rem",
          color: "var(--gog-text-muted)",
        }}>
          Your credentials are sent directly to GOG. Nothing is stored on this server.
        </p>
      </div>
    );
  }

  return <Library />;
}

function Step({ n, children }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
      <span style={{
        width: 24, height: 24,
        borderRadius: "50%",
        background: "var(--gog-purple)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {n}
      </span>
      <span style={{ lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

export default App;
