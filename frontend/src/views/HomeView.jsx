import React, { useRef } from "react";
import { ProfileCard } from "../components/ProfileCard";
import { normalizeText } from "../utils/text";

export function HomeView({
  searchQuery,
  searchMode,
  skillsCatalog,
  profiles,
  isSearching,
  searchError,
  myProfile,
  onSearchChange,
  onSearchSubmit,
  onOpenProfile,
}) {
  const inputRef = useRef(null);
  const trimmedQuery = searchQuery.trim();
  const activeNorm = normalizeText(searchQuery);

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

  return (
    <section id="view-home" className="view view-animate" aria-labelledby="home-heading">
      <div className="hero">
        <h1 className="hero-title" id="home-heading">
          Jeden chłop pomaga drugiemu
        </h1>
        <p className="hero-subtitle">
          chłop pomaga chłopu za free, aby sobie chłopy pomagały nawzajem
          <br />
          <br />
          no women. no money. no bs
        </p>
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

      {trimmedQuery && (
        <div className={`search-results-wrap ${isSearching ? "is-loading" : ""}`}>
          <div className="results-header" role="status" aria-live="polite">
            <span className="results-count">
              {isSearching && profiles.length === 0
                ? "Szukanie..."
                : `Znalezione profile: ${profiles.length}`}
            </span>
            <span className="active-filter-hint">
              {modeLabel ? `Szukasz „${trimmedQuery}” ${modeLabel}` : `Filtr: „${trimmedQuery}”`}
            </span>
          </div>

          {searchError ? (
            <div className="empty-state" role="alert">
              Nie udało się pobrać profili: {searchError}
            </div>
          ) : !isSearching && profiles.length === 0 ? (
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
          ) : (
            <div className="profiles-list">
              {profiles.map((p) => (
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
        </div>
      )}
    </section>
  );
}
