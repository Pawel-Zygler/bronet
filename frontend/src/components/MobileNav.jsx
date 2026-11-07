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
        href="/chlopchain"
        id="mobile-nav-link-chlopchain"
        aria-current={(activeNav === "chlopchain" || activeNav === "stats") ? "page" : undefined}
        className={`mobile-nav-item ${(activeNav === "chlopchain" || activeNav === "stats") ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/chlopchain")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <line x1="10" y1="6.5" x2="14" y2="6.5" />
          <line x1="10" y1="17.5" x2="14" y2="17.5" />
        </svg>
        <span>Chłopchain</span>
      </a>
      <a
        href="/rankingi"
        id="mobile-nav-link-rankings"
        aria-current={activeNav === "rankings" ? "page" : undefined}
        className={`mobile-nav-item ${activeNav === "rankings" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/rankingi")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
        <span>Rankingi</span>
      </a>
      <a
        href="/osiagniecia"
        id="mobile-nav-link-achievements"
        aria-current={activeNav === "achievements" ? "page" : undefined}
        className={`mobile-nav-item ${activeNav === "achievements" ? "is-active" : ""}`}
        onClick={(e) => handleLink(e, "/osiagniecia")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
        <span>Osiągnięcia</span>
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
