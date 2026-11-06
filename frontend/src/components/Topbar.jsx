import React from "react";

export function Topbar({
  activeNav,
  myProfile,
  onNavigate,
  onLogout,
  isEditorView,
  showMobileSave,
  isSaving,
  mobileHint,
  mobileHintError,
  isCompactView,
  onToggleCompactView,
}) {
  const handleLink = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <>
      <a href="#app-root" className="skip-link">
        Przejdź do treści
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="brand" onClick={(e) => handleLink(e, "/")}>
            bronet
          </a>

          <div className="topbar-right">
            {!isEditorView && (
              <button
                type="button"
                id="compact-view-toggle"
                className={`compact-toggle-btn ${isCompactView ? "is-active" : ""}`}
                onClick={onToggleCompactView}
                aria-pressed={isCompactView}
                title={isCompactView ? "Wyłącz widok kompaktowy" : "Włącz widok kompaktowy (15 profili na ekran)"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                <span className="compact-btn-text">
                  {isCompactView ? "Kompakt (wł.)" : "Kompakt"}
                </span>
              </button>
            )}

            <nav className="desktop-nav" aria-label="Główna nawigacja">
              <a
                href="/"
                aria-current={activeNav === "home" ? "page" : undefined}
                className={`nav-link ${activeNav === "home" ? "is-active" : ""}`}
                onClick={(e) => handleLink(e, "/")}
              >
                Szukaj
              </a>
              <a
                href="/dopasowania"
                aria-current={activeNav === "matches" ? "page" : undefined}
                className={`nav-link ${activeNav === "matches" ? "is-active" : ""}`}
                onClick={(e) => handleLink(e, "/dopasowania")}
              >
                Dopasowania
              </a>
              <a
                href="/statystyki"
                id="nav-link-stats"
                aria-current={activeNav === "stats" ? "page" : undefined}
                className={`nav-link ${activeNav === "stats" ? "is-active" : ""}`}
                onClick={(e) => handleLink(e, "/statystyki")}
              >
                Statystyki
              </a>
              <a
                href="/profil"
                aria-current={activeNav === "profile" ? "page" : undefined}
                className={`nav-link ${activeNav === "profile" ? "is-active" : ""}`}
                onClick={(e) => handleLink(e, "/profil")}
              >
                {myProfile ? `Profil (${myProfile.name})` : "Profil"}
              </a>
              {myProfile && (
                <button type="button" className="nav-link nav-btn" onClick={onLogout}>
                  Wyloguj
                </button>
              )}
            </nav>

            {isEditorView && (showMobileSave || mobileHint) && (
              <div className="mobile-top-actions">
                <span
                  className={`mobile-save-hint ${mobileHintError ? "is-error" : ""}`}
                  role={mobileHintError ? "alert" : "status"}
                  aria-live={mobileHintError ? "assertive" : "polite"}
                >
                  {mobileHint}
                </span>
                {showMobileSave && (
                  <button
                    type="submit"
                    form="profile-form"
                    className="btn btn-primary mobile-top-save-btn"
                    disabled={isSaving}
                  >
                    Zapisz
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
