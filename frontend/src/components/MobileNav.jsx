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
        aria-current={activeNav === "home" ? "page" : undefined}
        className={`mobile-nav-item ${activeNav === "home" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.35" y2="16.35" />
        </svg>
        <span>Szukaj</span>
      </a>
      <a
        href="/dopasowania"
        aria-current={activeNav === "matches" ? "page" : undefined}
        className={`mobile-nav-item ${activeNav === "matches" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/dopasowania")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Dopasowania</span>
      </a>
      <a
        href="/mapa"
        aria-current={activeNav === "map" ? "page" : undefined}
        className={`mobile-nav-item ${activeNav === "map" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/mapa")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
        <span>Mapa</span>
      </a>
      <a
        href="/profil"
        aria-current={activeNav === "profile" ? "page" : undefined}
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
