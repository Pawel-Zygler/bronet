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
          <nav className="desktop-nav" aria-label="Główna nawigacja">
            <a
              href="/"
              aria-current={activeNav === "home" ? "page" : undefined}
              className={`nav-link ${activeNav === "home" ? "is-active" : ""}`}
              onClick={(e) => handleLink(e, "/")}
            >
              Szukaj chłopa
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
      </header>
    </>
  );
}
