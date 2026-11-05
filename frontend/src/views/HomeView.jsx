import React, { useEffect, useRef, useState } from "react";
import { ProfileCard } from "../components/ProfileCard";
import { normalizeText } from "../utils/text";

const PAGE_SIZE = 15;

export function HomeView({
  searchQuery,
  searchMode,
  skillsCatalog,
  profiles,
  isSearching,
  searchError,
  myProfile,
  isCompactView,
  onSearchChange,
  onSearchSubmit,
  onOpenProfile,
}) {
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);

  const trimmedQuery = searchQuery.trim();
  const activeNorm = normalizeText(searchQuery);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchMode]);

  const popularSource =
    searchMode === "can_help"
      ? skillsCatalog.can_help
      : searchMode === "need_help"
        ? skillsCatalog.need_help
        : skillsCatalog.all;

  const popularItems = (popularSource || []).slice(0, 12);

  const handlePopularClick = (skill) => {
    if (activeNorm && activeNorm === normalizeText(skill)) {
      onSearchChange("", searchMode);
    } else {
      onSearchChange(skill, searchMode);
    }
  };

  const handleCardSkillClick = (skill, mode) => {
    onSearchChange(skill, mode || "all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit();
    }
  };

  const modeLabel =
    searchMode === "can_help"
      ? "w sekcji „Umiem”"
      : searchMode === "need_help"
        ? "w sekcji „Potrzebuję”"
        : "";

  const shouldShowResults = Boolean(
    trimmedQuery || isCompactView || (profiles && profiles.length > 0)
  );

  const totalPages = Math.max(1, Math.ceil((profiles || []).length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, (profiles || []).length);
  const pagedProfiles = (profiles || []).slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 150, behavior: "smooth" });
    }
  };

  return (
    <section
      id="view-home"
      className={`view view-animate ${isCompactView ? "is-compact-mode" : ""}`}
      aria-labelledby="home-heading"
    >
      <div className={`hero ${isCompactView ? "is-compact" : ""}`}>
        <h1 className="hero-title" id="home-heading">
          Jeden chłop pomaga drugiemu
        </h1>
        {!isCompactView && (
          <p className="hero-subtitle">
            chłop pomaga chłopu za free, aby sobie chłopy pomagały nawzajem
            <br />
            <br />
            no women. no money. no bs
          </p>
        )}
      </div>

      <div className="search-section">
        <form role="search" aria-label="Wyszukiwarka profili" onSubmit={handleFormSubmit}>
          <div className="search-box">
            <svg
              className="search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.35" y2="16.35" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              id="search-input"
              className="search-input"
              aria-label="Szukaj po umiejętnościach, imieniu lub e-mailu"
              placeholder="Szukaj po umiejętnościach, imieniu lub e-mailu (np. qa, it, finanse)..."
              enterKeyHint="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value, searchMode)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchQuery) {
                  e.preventDefault();
                  onSearchChange("", searchMode);
                } else if (e.key === "Enter") {
                  if (onSearchSubmit) {
                    onSearchSubmit();
                  }
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                aria-label="Wyczyść wyszukiwanie"
                onClick={() => {
                  onSearchChange("", searchMode);
                  inputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
        </form>

        <div className="filter-bar" role="group" aria-label="Filtruj zakres wyszukiwania">
          {[
            { key: "all", label: "Wszystkie" },
            { key: "can_help", label: "Umiem (kto pomoże)" },
            { key: "need_help", label: "Potrzebuję (kto szuka)" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={searchMode === item.key}
              className={`filter-pill ${searchMode === item.key ? "is-active" : ""}`}
              onClick={() => onSearchChange(searchQuery, item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {popularItems.length > 0 && (
          <div className="popular-skills" role="group" aria-label="Popularne umiejętności">
            <span className="popular-label">Popularne:</span>
            {popularItems.map((item) => {
              const isSelected = Boolean(activeNorm && activeNorm === normalizeText(item.skill));
              return (
                <button
                  key={item.skill}
                  type="button"
                  aria-pressed={isSelected}
                  className={`skill-filter-chip ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handlePopularClick(item.skill)}
                >
                  {item.skill}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {shouldShowResults && (
        <div className={`search-results-wrap ${isSearching ? "is-loading" : ""}`}>
          <div ref={resultsRef} className="results-header" role="status" aria-live="polite">
            <span className="results-count">
              {isSearching && profiles.length === 0
                ? "Szukanie..."
                : trimmedQuery
                  ? `Znalezione profile: ${profiles.length}`
                  : `Wszystkie profile: ${profiles.length}`}
              {totalPages > 1 && ` (strona ${safePage} z ${totalPages})`}
            </span>
            <span className="active-filter-hint">
              {trimmedQuery
                ? modeLabel
                  ? `Szukasz „${trimmedQuery}” ${modeLabel}`
                  : `Filtr: „${trimmedQuery}”`
                : modeLabel
                  ? `Wszystkie profile (${modeLabel})`
                  : "Wszystkie profile w bazie"}
            </span>
          </div>

          {searchError ? (
            <div className="empty-state" role="alert">
              Nie udało się pobrać profili: {searchError}
            </div>
          ) : !isSearching && profiles.length === 0 && trimmedQuery ? (
            <div className="empty-state">
              Brak profili pasujących do wyszukiwania „{trimmedQuery}”.
              <br />
              <button
                type="button"
                className="text-action"
                style={{ marginTop: 8 }}
                onClick={() => {
                  onSearchChange("", "all");
                  inputRef.current?.focus();
                }}
              >
                Wyczyść wyszukiwanie
              </button>
            </div>
          ) : isCompactView ? (
            <ul className="compact-profiles-list" role="list">
              {pagedProfiles.map((p) => {
                const canText =
                  p.can_help && p.can_help.length > 0 ? p.can_help.join(", ") : "—";
                const needText =
                  p.need_help && p.need_help.length > 0 ? p.need_help.join(", ") : "—";
                const contactEmail =
                  p.email || (p.contact && p.contact.includes("@") ? p.contact.trim() : "");
                const mailtoHref = contactEmail ? `mailto:${contactEmail}` : null;

                return (
                  <li key={p.id} className="compact-profile-item">
                    <div className="compact-profile-text">
                      <a
                        href={`/profil/${p.id}`}
                        className="compact-profile-name"
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          onOpenProfile(p);
                        }}
                      >
                        {p.name}
                      </a>
                      <span className="compact-sep">, </span>
                      <span className="compact-label">pomaga z:</span>{" "}
                      <span className="compact-skills">{canText}</span>
                      <span className="compact-sep">; </span>
                      <span className="compact-label">szuka:</span>{" "}
                      <span className="compact-skills">{needText}</span>
                      <span className="compact-dot">.</span>
                    </div>

                    <div className="compact-profile-actions">
                      {mailtoHref ? (
                        <a
                          href={mailtoHref}
                          className="compact-action-btn compact-email-btn"
                          title={`Napisz e-mail: ${contactEmail}`}
                          aria-label={`Napisz do ${p.name}`}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="compact-action-btn compact-email-btn"
                          title={`Kontakt: ${p.contact || "Brak e-maila"}`}
                          aria-label={`Kontakt do ${p.name}`}
                          onClick={() => onOpenProfile(p)}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </button>
                      )}

                      <a
                        href={`/profil/${p.id}`}
                        className="compact-action-btn compact-profile-link"
                        title={`Zobacz profil: ${p.name}`}
                        aria-label={`Profil ${p.name}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          onOpenProfile(p);
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="profiles-list">
              {pagedProfiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  myProfile={myProfile}
                  searchQuery={searchQuery}
                  searchMode={searchMode}
                  onOpenProfile={onOpenProfile}
                  onSelectSkill={handleCardSkillClick}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="pagination-bar" aria-label="Stronicowanie wyników">
              <button
                type="button"
                id="pagination-prev"
                className="pagination-btn pagination-prev"
                disabled={safePage <= 1}
                onClick={() => handlePageChange(safePage - 1)}
                aria-label="Poprzednia strona"
              >
                ← Poprzednia
              </button>

              <div className="pagination-info" aria-live="polite">
                <span className="pagination-current-page">
                  Strona <strong>{safePage}</strong> z <strong>{totalPages}</strong>
                </span>
                <span className="pagination-range-sub">
                  ({startIndex + 1}–{endIndex} z {profiles.length})
                </span>
              </div>

              <button
                type="button"
                id="pagination-next"
                className="pagination-btn pagination-next"
                disabled={safePage >= totalPages}
                onClick={() => handlePageChange(safePage + 1)}
                aria-label="Następna strona"
              >
                Następna →
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
