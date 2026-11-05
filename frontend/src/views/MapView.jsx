import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  POPULAR_CITIES,
  calculateDistanceKm,
  findCityCoords,
} from "../utils/cities";
import { normalizeText } from "../utils/text";

const MAP_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_MAP_API_KEY) ||
  "";

const TILE_PROVIDERS = {
  voyager: {
    name: "Kolorowa (Apple/Google style)",
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${
      MAP_API_KEY ? `?api_key=${MAP_API_KEY}` : ""
    }`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  },
  osm: {
    name: "Standard (OpenStreetMap)",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19,
  },
  dark: {
    name: "Ciemna (Dark Matter)",
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${
      MAP_API_KEY ? `?api_key=${MAP_API_KEY}` : ""
    }`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  },
};

const POLAND_CENTER = [52.0693, 19.4803];
const DEFAULT_ZOOM = 6;

export function MapView({ myProfile, profiles = [], matchesData = null, onOpenProfile, onNavigate }) {
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'mutual' | 'i_help' | 'they_help'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [isListViewOpen, setIsListViewOpen] = useState(false);
  const [tileMode, setTileMode] = useState("voyager");

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersGroupRef = useRef(null);

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

  // Profile z współrzędnymi geograficznymi
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

  // Filtrowanie profili
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

      // Filtr wyszukiwarki tekstowej
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

  // Inicjalizacja instancji Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: POLAND_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    const activeTile = TILE_PROVIDERS[tileMode] || TILE_PROVIDERS.voyager;
    const tileLayer = L.tileLayer(activeTile.url, {
      attribution: activeTile.attribution,
      subdomains: activeTile.subdomains,
      maxZoom: activeTile.maxZoom,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Obsługa kliknięć natywnych w kontenerze mapy
    const container = mapContainerRef.current;
    const handleNativeMarkerClick = (e) => {
      const markerEl = e.target.closest("[data-profile-id]");
      if (markerEl) {
        const id = Number(markerEl.getAttribute("data-profile-id"));
        if (id) {
          setActiveProfileId(id);
        }
      }
    };
    container.addEventListener("click", handleNativeMarkerClick);

    window.__bronetSelectProfile = (id) => {
      setActiveProfileId(id);
    };

    // Wymuś prawidłowe wymiary kafelków po zamontowaniu
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      delete window.__bronetSelectProfile;
      container.removeEventListener("click", handleNativeMarkerClick);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Przełączanie stylu kafelków (Voyager / OSM / Dark)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const activeTile = TILE_PROVIDERS[tileMode] || TILE_PROVIDERS.voyager;
    tileLayerRef.current.setUrl(activeTile.url);
  }, [tileMode]);

  // Synchronizacja pinezek na mapie Leaflet
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    filteredProfiles.forEach((p) => {
      // Spiralny jitter współrzędnych zapobiegający nakładaniu się profili w jednym mieście
      const angle = ((p.id * 137.5) % 360) * (Math.PI / 180);
      const radius = 0.003 + (p.id % 5) * 0.0025;
      const displayLat = p.lat + radius * Math.cos(angle);
      const displayLng = p.lng + radius * Math.sin(angle) * 1.4;

      const isMutual = p.matchType === "mutual";
      const isMe = myProfile && myProfile.id === p.id;

      let pinClass = "pin-default";
      let symbol = "👨";
      if (isMe) {
        pinClass = "pin-me";
        symbol = "📍";
      } else if (isMutual) {
        pinClass = "pin-mutual";
        symbol = "🤝";
      } else if (p.matchType === "i_help") {
        pinClass = "pin-i-help";
        symbol = "📤";
      } else if (p.matchType === "they_help") {
        pinClass = "pin-they-help";
        symbol = "📥";
      }

      const isSelected = activeProfileId === p.id;
      const displayName = (p.name || "Chłop").split(" ")[0];

      const html = `
        <div id="map-marker-${p.id}" class="bronet-leaflet-marker ${pinClass} ${
        isSelected ? "is-active" : ""
      }" data-profile-id="${p.id}" onclick="window.__bronetSelectProfile && window.__bronetSelectProfile(${p.id})" title="${p.name} (${p.cityName})">
          <div class="marker-bubble">
            <span class="marker-icon">${symbol}</span>
            ${isMutual ? '<span class="marker-pulse"></span>' : ""}
          </div>
          <div class="marker-label">${displayName}</div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "bronet-div-icon-wrapper",
        html: html,
        iconSize: [38, 48],
        iconAnchor: [19, 44],
        popupAnchor: [0, -44],
      });

      const marker = L.marker([displayLat, displayLng], {
        icon: customIcon,
        zIndexOffset: isMutual ? 600 : isMe ? 500 : isSelected ? 700 : 100,
      });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setActiveProfileId(p.id);
      });

      markersGroup.addLayer(marker);
    });
  }, [filteredProfiles, activeProfileId, myProfile]);

  // Centrowanie mapy po wybraniu miasta z listy
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedCity && selectedCity !== "all") {
      const city = POPULAR_CITIES.find((c) => c.name === selectedCity);
      if (city) {
        mapInstanceRef.current.flyTo([city.lat, city.lng], 11, { duration: 1.2 });
      }
    } else if (selectedCity === "all") {
      mapInstanceRef.current.flyTo(POLAND_CENTER, DEFAULT_ZOOM, { duration: 1 });
    }
  }, [selectedCity]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleZoomReset = () => {
    mapInstanceRef.current?.setView(POLAND_CENTER, DEFAULT_ZOOM);
    setSelectedCity("all");
  };

  const handleFocusProfile = (profile) => {
    setActiveProfileId(profile.id);
    if (mapInstanceRef.current && profile.lat && profile.lng) {
      mapInstanceRef.current.flyTo([profile.lat, profile.lng], 12, { duration: 1 });
    }
  };

  return (
    <section id="view-map" className="view view-animate" aria-labelledby="map-heading">
      <div className="hero">
        <h1 className="hero-title" id="map-heading">
          Mapa Chłopów
        </h1>
        <p className="hero-subtitle">
          prawdziwa interaktywna mapa z chłopami w Twojej okolicy i dopasowaniami 1:1
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
              placeholder="Filtruj mapę (np. miasto, programista, hydraulik)..."
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

          <div className="map-tile-picker">
            <label htmlFor="map-tile-select" className="visually-hidden">
              Styl mapy:
            </label>
            <select
              id="map-tile-select"
              className="matching-select"
              value={tileMode}
              onChange={(e) => setTileMode(e.target.value)}
              title="Wybierz styl mapy"
            >
              <option value="voyager">🗺️ Kolorowa (Apple/Google)</option>
              <option value="osm">🌍 OpenStreetMap Standard</option>
              <option value="dark">🌙 Ciemna (Dark Mode)</option>
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

      {/* Kontener Prawdziwej Mapy Leaflet */}
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
            title="Resetuj widok do całej Polski"
            aria-label="Resetuj widok"
            onClick={handleZoomReset}
          >
            ↺
          </button>
        </div>

        {/* Prawdziwe płótno mapy Leaflet */}
        <div
          id="poland-profile-map"
          ref={mapContainerRef}
          className="leaflet-map-canvas"
          role="region"
          aria-label="Interaktywna mapa Polski z profilami chłopów"
        />

        {/* Karta szczegółów wybranego chłopa (Floating Detail Card) */}
        {activeProfile && (
          <div className="map-detail-card" role="dialog" aria-labelledby="map-card-name">
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
                <h3 className="map-card-name" id="map-card-name">
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

      {/* Opcjonalny widok listy pod mapą */}
      {isListViewOpen && (
        <div className="map-list-view">
          <div className="matching-section-header">
            <h3>Chłopy na mapie w tym widoku ({filteredProfiles.length})</h3>
            <p className="section-desc">
              Kliknij „Zobacz na mapie”, aby przybliżyć punkt konkretnego chłopa.
            </p>
          </div>

          <div className="matching-grid">
            {filteredProfiles.slice(0, 30).map((p) => {
              const isMutual = p.matchType === "mutual";
              const isSelected = p.id === activeProfileId;

              return (
                <article
                  key={p.id}
                  className={`matching-card ${isMutual ? "is-mutual" : ""} ${
                    isSelected ? "is-selected" : ""
                  }`}
                >
                  <header className="matching-card-header">
                    <div>
                      <h4 className="matching-card-title">
                        <a
                          href={`/profil/${p.id}`}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                            e.preventDefault();
                            onOpenProfile(p);
                          }}
                        >
                          {p.name}
                        </a>
                      </h4>
                      <div className="matching-card-location">
                        📍 {p.cityName}
                        {p.distanceKm != null && <span> • ~{p.distanceKm} km</span>}
                      </div>
                    </div>

                    {isMutual ? (
                      <span className="badge badge-mutual">🤝 Wzajemne 1:1</span>
                    ) : (
                      <span className="badge badge-subtle">
                        {p.matchType === "i_help"
                          ? "Możesz pomóc"
                          : p.matchType === "they_help"
                          ? "Może pomóc"
                          : "Na mapie"}
                      </span>
                    )}
                  </header>

                  <div className="matching-card-body">
                    <div className="matching-skills-group">
                      <span className="matching-label">Pomoże w:</span>
                      <div className="tag-list">
                        {(p.can_help || []).slice(0, 4).map((s) => (
                          <span key={s} className="tag tag-can">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="matching-skills-group">
                      <span className="matching-label">Szuka pomocy w:</span>
                      <div className="tag-list">
                        {(p.need_help || []).slice(0, 4).map((s) => (
                          <span key={s} className="tag tag-need">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <footer className="matching-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleFocusProfile(p)}
                    >
                      Pokaż na mapie 📍
                    </button>
                    {p.email && (
                      <a
                        href={`mailto:${p.email}?subject=${encodeURIComponent(
                          `Kontakt z mapy Bronet: ${p.name}`
                        )}`}
                        className="btn btn-primary btn-sm"
                      >
                        Napisz e-mail
                      </a>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
          {filteredProfiles.length > 30 && (
            <p className="pagination-info" style={{ marginTop: 16 }}>
              Pokazano 30 z {filteredProfiles.length} profili. Przybliż mapę lub wybierz konkretne
              miasto, aby zawęzić wyniki.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
