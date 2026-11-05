import React from "react";

export function MobileNav({ activeNav, myProfile, onNavigate }) {
  const handleLink = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Nawigacja mobilna">
      <a
        href="/"
        className={`mobile-nav-item ${activeNav === "home" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.35" y2="16.35" />
        </svg>
        <span>Szukaj chłopa</span>
      </a>
      <a
        href="/profil"
        className={`mobile-nav-item ${activeNav === "profile" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/profil")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>{myProfile ? myProfile.name : "Profil"}</span>
      </a>
    </nav>
  );
}

