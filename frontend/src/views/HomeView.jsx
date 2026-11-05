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

  const modeLabel =
    searchMode === "can_help"
      ? "w sekcji „Umiem”"
      : searchMode === "need_help"
      ? "w sekcji „Potrzebuję”"
      : "";

  return (
    <section id="view-home" className="view view-animate">
      <div className="hero">
        <h1 className="hero-title">Jeden chłop pomaga drugiemu.</h1>
        <p className="hero-subtitle">
          Zapisz w profilu co <strong>umiesz</strong> i czego <strong>potrzebujesz</strong>. Wyszukaj
          ludzi po umiejętnościach i wymieńcie się konkretną pomocą.
        </p>
      </div>

      <div className="search-section" aria-label="Wyszukiwarka profili">
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
            placeholder="Szukaj po umiejętnościach lub imieniu (np. qa, it, finanse, związki)..."
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value, searchMode)}
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

        <div className="filter-bar" role="tablist" aria-label="Filtruj zakres wyszukiwania">
          <button
            type="button"
            className={`filter-pill ${searchMode === "all" ? "is-active" : ""}`}
            onClick={() => onSearchChange(searchQuery, "all")}
          >
            Wszystkie
          </button>
          <button
            type="button"
            className={`filter-pill ${searchMode === "can_help" ? "is-active" : ""}`}
            onClick={() => onSearchChange(searchQuery, "can_help")}
          >
            Umiem (kto pomoże)
          </button>
          <button
            type="button"
            className={`filter-pill ${searchMode === "need_help" ? "is-active" : ""}`}
            onClick={() => onSearchChange(searchQuery, "need_help")}
          >
            Potrzebuję (kto szuka)
          </button>
        </div>

        {popularItems.length > 0 && (
          <div className="popular-skills">
            <span className="popular-label">Popularne:</span>
            {popularItems.map((item) => {
              const isSelected = Boolean(activeNorm && activeNorm === normalizeText(item.skill));
              return (
                <button
                  key={item.skill}
                  type="button"
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
          <div className="results-header">
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
            <div className="empty-state">Nie udało się pobrać profili: {searchError}</div>
          ) : !isSearching && profiles.length === 0 ? (
            <div className="empty-state">
              Brak profili pasujących do wyszukiwania „{trimmedQuery}”.
              <br />
              <button
                type="button"
                className="text-action"
                style={{ marginTop: 8 }}
                onClick={() => onSearchChange("", "all")}
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

