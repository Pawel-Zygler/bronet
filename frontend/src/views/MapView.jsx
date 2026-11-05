import React, { useMemo, useState } from "react";
import {
  POLAND_BOUNDS,
  POPULAR_CITIES,
  calculateDistanceKm,
  findCityCoords,
  projectCoords,
} from "../utils/cities";
import { normalizeText } from "../utils/text";

export function MapView({ myProfile, profiles = [], matchesData = null, onOpenProfile, onNavigate }) {
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'mutual' | 'i_help' | 'they_help'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isListViewOpen, setIsListViewOpen] = useState(false);

  // Zbuduj mapę dopasowań dla zalogowanego użytkownika
  const matchesMap = useMemo(() => {
    const map = {};
    if (!matchesData) return map;

    (matchesData.mutual || []).forEach((m) => {
      map[m.profile.id] = {
        type: "mutual",
        theyCanHelp: m.they_can_help_with || [],
        iCanHelp: m.i_can_help_with || [],
      };
    });

    (matchesData.they_help_me || []).forEach((m) => {
      if (!map[m.profile.id]) {
        map[m.profile.id] = {
          type: "they_help",
          theyCanHelp: m.they_can_help_with || [],
          iCanHelp: [],
        };
      }
    });

    (matchesData.i_help_them || []).forEach((m) => {
      if (!map[m.profile.id]) {
        map[m.profile.id] = {
          type: "i_help",
          theyCanHelp: [],
          iCanHelp: m.i_can_help_with || [],
        };
      }
    });

    return map;
  }, [matchesData]);

  // Profile, które mają współrzędne lub przypisane miasto
  const locatedProfiles = useMemo(() => {
    return profiles
      .filter((p) => p && (p.share_location || (p.lat && p.lng) || p.location_name))
      .map((p) => {
        let lat = p.lat;
        let lng = p.lng;
        let cityName = p.location_name || "";

        if ((lat == null || lng == null) && cityName) {
          const found = findCityCoords(cityName);
          if (found) {
            lat = found.lat;
            lng = found.lng;
            cityName = found.name;
          }
        }

        const matchInfo = matchesMap[p.id] || null;
        let matchType = matchInfo ? matchInfo.type : "none";

        // Odległość od zalogowanego chłopa (jeśli zalogowany ma współrzędne)
        let distanceKm = null;
        if (myProfile && myProfile.lat && myProfile.lng && lat && lng) {
          distanceKm = calculateDistanceKm(myProfile.lat, myProfile.lng, lat, lng);
        }

        return {
          ...p,
          lat,
          lng,
          cityName: cityName || "Polska",
          matchInfo,
          matchType,
          distanceKm,
        };
      })
      .filter((p) => p.lat != null && p.lng != null);
  }, [profiles, matchesMap, myProfile]);

  // Filtrowanie profili na mapie
  const filteredProfiles = useMemo(() => {
    const qNorm = normalizeText(searchQuery);

    return locatedProfiles.filter((p) => {
      // Filtr kategorii dopasowania
      if (filterMode === "mutual" && p.matchType !== "mutual") return false;
      if (filterMode === "i_help" && p.matchType !== "i_help" && p.matchType !== "mutual") return false;
      if (filterMode === "they_help" && p.matchType !== "they_help" && p.matchType !== "mutual")
        return false;

      // Filtr miasta
      if (selectedCity !== "all") {
        if (normalizeText(p.cityName) !== normalizeText(selectedCity)) return false;
      }

      // Filtr wyszukiwarki (miasto, umiejętności, imię)
      if (qNorm) {
        const nameNorm = normalizeText(p.name);
        const cityNorm = normalizeText(p.cityName);
        const canNorms = (p.can_help || []).map(normalizeText);
        const needNorms = (p.need_help || []).map(normalizeText);

        const match =
          nameNorm.includes(qNorm) ||
          cityNorm.includes(qNorm) ||
          canNorms.some((s) => s.includes(qNorm)) ||
          needNorms.some((s) => s.includes(qNorm));
        if (!match) return false;
      }

      return true;
    });
  }, [locatedProfiles, filterMode, selectedCity, searchQuery]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return locatedProfiles.find((p) => p.id === activeProfileId) || null;
  }, [activeProfileId, locatedProfiles]);

  const mutualCount = locatedProfiles.filter((p) => p.matchType === "mutual").length;
  const iHelpCount = locatedProfiles.filter((p) => p.matchType === "i_help" || p.matchType === "mutual").length;
  const theyHelpCount = locatedProfiles.filter(
    (p) => p.matchType === "they_help" || p.matchType === "mutual"
  ).length;

  const handleMarkerClick = (profile) => {
    setActiveProfileId(profile.id === activeProfileId ? null : profile.id);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.75));
  const handleZoomReset = () => setZoomLevel(1);

  return (
    <section id="view-map" className="view view-animate" aria-labelledby="map-heading">
      <div className="hero">
        <h1 className="hero-title" id="map-heading">
          Mapa Chłopów
        </h1>
        <p className="hero-subtitle">
          zobacz, gdzie są chłopy w Twojej okolicy i z kim możesz wymienić się pomocą 1:1
          <br />
          <br />
          bez pośredników. bez ściemy. chłop pomaga chłopu blisko domu.
        </p>
      </div>

      {/* Komunikat o lokalizacji zalogowanego profilu */}
      <div className="map-banner" role="region" aria-label="Status lokalizacji">
        {myProfile ? (
          myProfile.location_name || (myProfile.lat && myProfile.lng) ? (
            <div className="map-banner-content">
              <span className="map-banner-icon">📍</span>
              <div>
                Twoja lokalizacja na mapie:{" "}
                <strong>{myProfile.location_name || "Współrzędne GPS zapisane"}</strong>.
                {myProfile.share_location ? (
                  <span className="badge badge-success" style={{ marginLeft: 8 }}>
                    Udostępniona ✓
                  </span>
                ) : (
                  <span className="badge badge-subtle" style={{ marginLeft: 8 }}>
                    Ukryta
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate("/profil")}
              >
                Zmień lokalizację →
              </button>
            </div>
          ) : (
            <div className="map-banner-content">
              <span className="map-banner-icon">💡</span>
              <div>
                Nie masz jeszcze ustawionej lokalizacji w profilu. Ustaw swoje miasto, aby chłopy z
                okolicy mogły Cię znaleźć!
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate("/profil")}
              >
                Ustaw lokalizację w profilu →
              </button>
            </div>
          )
        ) : (
          <div className="map-banner-content">
            <span className="map-banner-icon">🤝</span>
            <div>
              Przeglądasz mapę chłopów jako gość.{" "}
              <strong>Załóż lub otwórz swój profil</strong>, aby automatycznie widzieć dopasowania 1:1
              w okolicy!
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate("/profil")}
            >
              Załóż profil →
            </button>
          </div>
        )}
      </div>

      {/* Pasek filtrów mapy */}
      <div className="map-controls-panel">
        <div className="map-filter-tabs" role="tablist" aria-label="Filtry dopasowań na mapie">
          <button
            type="button"
            id="map-filter-all"
            role="tab"
            aria-selected={filterMode === "all"}
            className={`map-tab-btn ${filterMode === "all" ? "is-active" : ""}`}
            onClick={() => setFilterMode("all")}
          >
            Wszyscy na mapie ({locatedProfiles.length})
          </button>
          <button
            type="button"
            id="map-filter-mutual"
            role="tab"
            aria-selected={filterMode === "mutual"}
            className={`map-tab-btn ${filterMode === "mutual" ? "is-active" : ""}`}
            onClick={() => setFilterMode("mutual")}
          >
            🤝 Dopasowania 1:1 ({mutualCount})
          </button>
          <button
            type="button"
            id="map-filter-i-help"
            role="tab"
            aria-selected={filterMode === "i_help"}
            className={`map-tab-btn ${filterMode === "i_help" ? "is-active" : ""}`}
            onClick={() => setFilterMode("i_help")}
          >
            📤 Możesz pomóc ({iHelpCount})
          </button>
          <button
            type="button"
            id="map-filter-they-help"
            role="tab"
            aria-selected={filterMode === "they_help"}
            className={`map-tab-btn ${filterMode === "they_help" ? "is-active" : ""}`}
            onClick={() => setFilterMode("they_help")}
          >
            📥 Mogą pomóc ({theyHelpCount})
          </button>
        </div>

        <div className="map-search-row">
          <div className="map-search-box">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.35" y2="16.35" />
            </svg>
            <input
              type="search"
              id="map-search-input"
              className="inline-input map-search-input"
              placeholder="Filtruj mapę (np. miasto, qa, hydraulik)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                aria-label="Wyczyść filtr"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>

          <div className="map-city-picker">
            <label htmlFor="map-city-select" className="visually-hidden">
              Wybierz miasto:
            </label>
            <select
              id="map-city-select"
              className="matching-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="all">Cała Polska (wszystkie miasta)</option>
              {POPULAR_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsListViewOpen((prev) => !prev)}
            aria-expanded={isListViewOpen}
          >
            {isListViewOpen ? "Ukryj listę profili ▲" : `Pokaż listę (${filteredProfiles.length}) ▼`}
          </button>
        </div>

        {/* Legenda */}
        <div className="map-legend">
          <span className="legend-item">
            <span className="legend-pin legend-pin-mutual"></span>
            <strong>🤝 Wzajemne 1:1</strong>
          </span>
          <span className="legend-item">
            <span className="legend-pin legend-pin-help"></span>
            Możesz / Może pomóc
          </span>
          <span className="legend-item">
            <span className="legend-pin legend-pin-default"></span>
            Chłop na mapie
          </span>
          {myProfile && myProfile.lat && myProfile.lng && (
            <span className="legend-item">
              <span className="legend-pin legend-pin-me"></span>
              Twój punkt
            </span>
          )}
        </div>
      </div>

      {/* Kontener Mapy */}
      <div className="map-viewport-container">
        {/* Przyciski Zoom */}
        <div className="map-zoom-controls" role="group" aria-label="Kontrolki zoomu mapy">
          <button
            type="button"
            id="map-zoom-in"
            className="map-zoom-btn"
            title="Przybliż mapę"
            aria-label="Przybliż"
            onClick={handleZoomIn}
          >
            +
          </button>
          <button
            type="button"
            id="map-zoom-out"
            className="map-zoom-btn"
            title="Oddal mapę"
            aria-label="Oddal"
            onClick={handleZoomOut}
          >
            −
          </button>
          <button
            type="button"
            id="map-zoom-reset"
            className="map-zoom-btn"
            title="Resetuj widok"
            aria-label="Resetuj widok"
            onClick={handleZoomReset}
          >
            ↺
          </button>
        </div>

        <div className="map-svg-wrapper">
          <svg
            id="poland-profile-map"
            className="map-svg"
            viewBox="0 0 900 700"
            role="region"
            aria-label="Interaktywna mapa Polski z profilami chłopów"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: "transform 0.25s ease-out",
            }}
          >
            {/* Tło i kontur Polski */}
            <defs>
              <linearGradient id="mapBgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e2430" />
                <stop offset="100%" stopColor="#12161f" />
              </linearGradient>
              <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Obszar tła */}
            <rect width="900" height="700" rx="16" fill="url(#mapBgGrad)" />

            {/* Kontur granic Polski (uproszczony realistyczny wielokąt granic RP) */}
            <polygon
              className="poland-outline"
              points="
                135,145 220,105 320,80 430,70 540,85 640,115 720,135 770,190
                805,250 815,340 790,440 780,510 740,580 670,640 590,650 500,640
                430,620 370,610 300,590 220,550 160,500 130,420 120,330 115,240 135,145
              "
              fill="#252e3d"
              stroke="#3a485f"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Wewnętrzne subtelne linie orientacyjne */}
            <path
              d="M 430,70 Q 520,300 480,630"
              fill="none"
              stroke="#2e3a4e"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <path
              d="M 125,240 Q 400,280 815,340"
              fill="none"
              stroke="#2e3a4e"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />

            {/* Etykiety głównych miast referencyjnych w tle */}
            {POPULAR_CITIES.slice(0, 10).map((c) => {
              const pt = projectCoords(c.lat, c.lng);
              if (!pt) return null;
              return (
                <g key={c.name} className="city-reference" opacity="0.45">
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#8892b0" />
                  <text
                    x={pt.x + 5}
                    y={pt.y - 4}
                    fontSize="10"
                    fill="#8892b0"
                    fontFamily="inherit"
                    fontWeight="500"
                  >
                    {c.name}
                  </text>
                </g>
              );
            })}

            {/* Marker zalogowanego użytkownika (jeśli posiada współrzędne) */}
            {myProfile && myProfile.lat && myProfile.lng && (
              (() => {
                const myPt = projectCoords(myProfile.lat, myProfile.lng);
                if (!myPt) return null;
                return (
                  <g className="my-location-marker">
                    <circle cx={myPt.x} cy={myPt.y} r="14" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.6">
                      <animate attributeName="r" values="8;18;8" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={myPt.x} cy={myPt.y} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                    <text x={myPt.x} y={myPt.y - 12} textAnchor="middle" fontSize="10" fill="#4ade80" fontWeight="bold">
                      Ty
                    </text>
                  </g>
                );
              })()
            )}

            {/* Pinezki profili chłopów */}
            {filteredProfiles.map((p) => {
              const pt = projectCoords(p.lat, p.lng);
              if (!pt) return null;

              const isSelected = p.id === activeProfileId;
              const isMutual = p.matchType === "mutual";
              const isHelp = p.matchType === "i_help" || p.matchType === "they_help";

              const pinColor = isMutual ? "#f59e0b" : isHelp ? "#3b82f6" : "#94a3b8";
              const pinGlow = isMutual ? "url(#glow-gold)" : undefined;

              return (
                <g
                  key={p.id}
                  id={`map-marker-${p.id}`}
                  className={`profile-marker ${isSelected ? "is-selected" : ""} ${
                    isMutual ? "is-mutual-marker" : ""
                  }`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => handleMarkerClick(p)}
                  cursor="pointer"
                  role="button"
                  aria-label={`Profil ${p.name}, miasto: ${p.cityName}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleMarkerClick(p);
                    }
                  }}
                >
                  {/* Efekt pulsowania dla dopasowań 1:1 */}
                  {isMutual && (
                    <circle cx="0" cy="-14" r="14" fill="#f59e0b" opacity="0.3">
                      <animate attributeName="r" values="10;22;10" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Kształt pinezki */}
                  <path
                    d="M 0,0 C -6,-10 -10,-15 -10,-22 A 10,10 0 1,1 10,-22 C 10,-15 6,-10 0,0 Z"
                    fill={pinColor}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? "2.5" : "1.2"}
                    filter={pinGlow}
                  />

                  {/* Ikona wewnątrz główki pinezki */}
                  <circle cx="0" cy="-22" r="4.5" fill="#ffffff" />

                  {/* Etykieta imienia pod pinezką */}
                  <text
                    x="0"
                    y="13"
                    textAnchor="middle"
                    fontSize={isSelected ? "11" : "9.5"}
                    fontWeight={isSelected || isMutual ? "bold" : "normal"}
                    fill={isSelected ? "#ffffff" : isMutual ? "#fbbf24" : "#cbd5e1"}
                    className="marker-label-text"
                  >
                    {isMutual ? `🤝 ${p.name}` : p.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Szczegółowa karta wybranego chłopa */}
        {activeProfile && (
          <div className="map-detail-card" role="dialog" aria-label={`Szczegóły profilu ${activeProfile.name}`}>
            <button
              type="button"
              className="map-card-close"
              aria-label="Zamknij podgląd"
              onClick={() => setActiveProfileId(null)}
            >
              ×
            </button>

            <div className="map-card-header">
              <div>
                <h3 className="map-card-name">
                  <a
                    href={`/profil/${activeProfile.id}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onOpenProfile(activeProfile);
                    }}
                  >
                    {activeProfile.name}
                  </a>
                </h3>
                <div className="map-card-location">
                  📍 {activeProfile.cityName}
                  {activeProfile.distanceKm != null && (
                    <span className="distance-badge"> (~{activeProfile.distanceKm} km od Ciebie)</span>
                  )}
                </div>
              </div>

              {activeProfile.matchType === "mutual" ? (
                <span className="badge badge-mutual">🤝 Wzajemna pomoc 1:1</span>
              ) : activeProfile.matchType === "i_help" ? (
                <span className="badge badge-i-help">Możesz mu pomóc</span>
              ) : activeProfile.matchType === "they_help" ? (
                <span className="badge badge-helps-me">Może Ci pomóc</span>
              ) : (
                <span className="badge badge-subtle">Chłop na mapie</span>
              )}
            </div>

            {/* Szczegóły dopasowania */}
            {activeProfile.matchInfo && activeProfile.matchInfo.theyCanHelp?.length > 0 && (
              <div className="map-exchange-row">
                <span className="exchange-label">
                  <strong>Pomoże z:</strong>
                </span>
                <span className="exchange-skills">{activeProfile.matchInfo.theyCanHelp.join(", ")}</span>
              </div>
            )}
            {activeProfile.matchInfo && activeProfile.matchInfo.iCanHelp?.length > 0 && (
              <div className="map-exchange-row">
                <span className="exchange-label">
                  <strong>Ty pomożesz z:</strong>
                </span>
                <span className="exchange-skills">{activeProfile.matchInfo.iCanHelp.join(", ")}</span>
              </div>
            )}

            {/* Umiejętności ogólne */}
            <div className="map-card-skills">
              <div>
                <strong>Umiem:</strong>{" "}
                {activeProfile.can_help?.length ? activeProfile.can_help.join(", ") : "—"}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Szukam:</strong>{" "}
                {activeProfile.need_help?.length ? activeProfile.need_help.join(", ") : "—"}
              </div>
            </div>

            <div className="map-card-actions">
              {activeProfile.email && (
                <a
                  href={`mailto:${activeProfile.email}?subject=${encodeURIComponent(
                    `Kontakt z mapy Bronet: ${activeProfile.name}`
                  )}`}
                  className="btn btn-primary btn-sm"
                >
                  Napisz e-mail
                </a>
              )}
              <a
                href={`/profil/${activeProfile.id}`}
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  onOpenProfile(activeProfile);
                }}
              >
                Otwórz pełny profil →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Rozwijana lista profili z mapy */}
      {isListViewOpen && (
        <div className="map-profiles-list-section" role="region" aria-label="Lista profili na mapie">
          <h2 className="section-subheading">
            Chłopy na mapie ({filteredProfiles.length})
          </h2>
          <div className="map-profiles-grid">
            {filteredProfiles.map((p) => {
              const isSelected = p.id === activeProfileId;
              return (
                <div
                  key={p.id}
                  className={`map-list-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => {
                    setActiveProfileId(p.id);
                    window.scrollTo({ top: 380, behavior: "smooth" });
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="map-item-header">
                    <strong>{p.name}</strong>
                    <span className="map-item-city">📍 {p.cityName}</span>
                  </div>
                  <div className="map-item-skills">
                    <span>Umiem: {p.can_help?.slice(0, 2).join(", ") || "—"}</span>
                  </div>
                  {p.matchType === "mutual" && (
                    <span className="badge badge-mutual" style={{ marginTop: 4 }}>
                      🤝 1:1
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

