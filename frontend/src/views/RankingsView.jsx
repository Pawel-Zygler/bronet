import React, { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api";

export function RankingsView({ onOpenProfile, onNavigate }) {
  const [rankingsData, setRankingsData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [visibleRankingsCount, setVisibleRankingsCount] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Debounce wyszukiwania 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setVisibleRankingsCount(15);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCityChange = (city) => {
    setSelectedCity(city);
    setVisibleRankingsCount(15);
  };

  const fetchRankings = useCallback(async (isManual = false) => {
    if (isManual) setIsLoading(true);
    setError("");
    try {
      const q = debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : "";
      const data = await apiGet(`/api/chlopocoin/rankings${q}`);
      setRankingsData(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err?.message || "Nie udało się pobrać danych rankingu.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchRankings();
    // Odświeżanie w tle co 5 sekund
    const interval = setInterval(() => {
      fetchRankings(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchRankings]);

  const allItems = rankingsData?.leaderboard || [];
  const filteredItems = selectedCity === "all"
    ? allItems
    : allItems.filter((item) => (item.location_name || "").toLowerCase() === selectedCity.toLowerCase());

  const topThree = rankingsData?.top_three || [];
  const totalHolders = rankingsData?.total_holders_count || 0;
  const totalCoins = rankingsData?.total_coins_minted || 0;

  return (
    <div className="rankings-view view-animate" id="rankings-container">
      {/* Nagłówek sekcji */}
      <div className="rankings-header">
        <div className="rankings-title-group">
          <div className="rankings-badge">
            <span className="trophy-pulse-icon" aria-hidden="true">🏆</span>
            <span>Społeczność Bronet • Hall of Fame</span>
          </div>
          <h1 id="rankings-heading">Rankingi Pomocnych Chłopów</h1>
          <p className="rankings-lead">
            Liderzy wzajemnej pomocy uszeregowani według liczby wykopanych Chłopocoinów (🪙 CC).
            Każdy coin to dowód bezinteresownego wsparcia innego chłopa potwierdzony konsensusem 2/2 w sieci Chłopchain.
          </p>
        </div>

        <div className="rankings-actions">
          <button
            type="button"
            id="btn-refresh-rankings"
            className="btn btn-secondary btn-refresh-stats"
            onClick={() => fetchRankings(true)}
            disabled={isLoading}
            title="Pobierz najświeższe dane z rankingu"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={isLoading ? "spin-icon" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{isLoading ? "Aktualizacja..." : "Odśwież ranking"}</span>
          </button>
          {lastRefreshed && (
            <span className="stats-last-refreshed">
              Stan na: {lastRefreshed.toLocaleTimeString("pl-PL")}
            </span>
          )}
        </div>
      </div>

      {/* Komunikat o błędzie */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Karty podsumowania metryk rankingu */}
      <div className="rankings-summary-grid">
        <div className="summary-card">
          <span className="summary-card-icon" aria-hidden="true">👑</span>
          <div className="summary-card-info">
            <span className="summary-card-label">Lider społeczności</span>
            <strong className="summary-card-val">
              {topThree[0]?.name ? `${topThree[0].name} (${topThree[0].chlopocoin_balance} CC)` : "—"}
            </strong>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-card-icon" aria-hidden="true">🤝</span>
          <div className="summary-card-info">
            <span className="summary-card-label">Pomocni chłopi w sieci</span>
            <strong className="summary-card-val" id="rankings-total-holders">
              {totalHolders}
            </strong>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-card-icon" aria-hidden="true">🪙</span>
          <div className="summary-card-info">
            <span className="summary-card-label">Wykopane Chłopocoiny</span>
            <strong className="summary-card-val" id="rankings-total-coins">
              {totalCoins} CC
            </strong>
          </div>
        </div>
      </div>

      {/* Podium Top 3 */}
      {topThree.length >= 3 && !debouncedQuery && selectedCity === "all" && (
        <div className="podium-section" aria-label="Podium najlepszych pomocników">
          <div className="podium-grid">
            {/* 2. Miejsce - Srebro */}
            <div className="podium-card rank-silver" onClick={() => onOpenProfile(topThree[1].id)} role="button" tabIndex={0}>
              <div className="podium-badge">🥈 #2 Srebrny Chłop</div>
              <h3 className="podium-name">{topThree[1].name}</h3>
              <p className="podium-loc">{topThree[1].location_name || "Polska"}</p>
              <div className="podium-balance">🪙 {topThree[1].chlopocoin_balance} CC</div>
              <div className="podium-skills">
                {(topThree[1].can_help || []).slice(0, 2).map((s) => (
                  <span key={s} className="tag tag-can">{s}</span>
                ))}
              </div>
            </div>

            {/* 1. Miejsce - Złoto (Najwyższe) */}
            <div className="podium-card rank-gold" onClick={() => onOpenProfile(topThree[0].id)} role="button" tabIndex={0}>
              <div className="podium-crown" aria-hidden="true">👑</div>
              <div className="podium-badge">🥇 #1 Złoty Chłop</div>
              <h3 className="podium-name">{topThree[0].name}</h3>
              <p className="podium-loc">{topThree[0].location_name || "Polska"}</p>
              <div className="podium-balance">🪙 {topThree[0].chlopocoin_balance} CC</div>
              <div className="podium-skills">
                {(topThree[0].can_help || []).slice(0, 3).map((s) => (
                  <span key={s} className="tag tag-can">{s}</span>
                ))}
              </div>
            </div>

            {/* 3. Miejsce - Brąz */}
            <div className="podium-card rank-bronze" onClick={() => onOpenProfile(topThree[2].id)} role="button" tabIndex={0}>
              <div className="podium-badge">🥉 #3 Brązowy Chłop</div>
              <h3 className="podium-name">{topThree[2].name}</h3>
              <p className="podium-loc">{topThree[2].location_name || "Polska"}</p>
              <div className="podium-balance">🪙 {topThree[2].chlopocoin_balance} CC</div>
              <div className="podium-skills">
                {(topThree[2].can_help || []).slice(0, 2).map((s) => (
                  <span key={s} className="tag tag-can">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pasek wyszukiwania i filtrów tabeli */}
      <div className="rankings-filter-bar">
        <div className="rankings-search-wrap">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="search-input-icon"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            id="rankings-search-input"
            className="form-control rankings-search-input"
            placeholder="Szukaj chłopa po imieniu, mieście lub umiejętności..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Wyczyść filtr"
            >
              ✕
            </button>
          )}
        </div>

        <div className="rankings-city-pills" role="radiogroup" aria-label="Filtr lokalizacji">
          <button
            type="button"
            className={`city-pill ${selectedCity === "all" ? "is-active" : ""}`}
            onClick={() => handleCityChange("all")}
          >
            Wszyscy ({allItems.length})
          </button>
          {["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk"].map((city) => (
            <button
              key={city}
              type="button"
              className={`city-pill ${selectedCity === city ? "is-active" : ""}`}
              onClick={() => handleCityChange(city)}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Główna tabela rankingu */}
      <div className="table-responsive" id="panel-stats-leaderboard">
        <table className="stats-table" id="global-stats-leaderboard">
          <thead>
            <tr>
              <th>Pozycja</th>
              <th>Chłop</th>
              <th>Lokalizacja</th>
              <th>Saldo monet</th>
              <th>W czym pomaga</th>
              <th>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.slice(0, visibleRankingsCount).map((item, idx) => (
              <tr key={item.id} className={idx < 3 ? `top-row rank-${idx + 1}` : ""}>
                <td className="rank-cell">
                  {idx === 0 && <span className="rank-medal">🥇 #1</span>}
                  {idx === 1 && <span className="rank-medal">🥈 #2</span>}
                  {idx === 2 && <span className="rank-medal">🥉 #3</span>}
                  {idx > 2 && <span className="rank-num">#{idx + 1}</span>}
                </td>
                <td className="name-cell">
                  <strong>{item.name}</strong>
                </td>
                <td className="loc-cell">{item.location_name || "Polska"}</td>
                <td className="balance-cell">
                  <span className="badge-coin-balance">
                    🪙 {item.chlopocoin_balance} CC
                  </span>
                </td>
                <td className="skills-cell">
                  {item.can_help && item.can_help.length > 0 ? (
                    <div className="skills-tag-list">
                      {item.can_help.slice(0, 3).map((s) => (
                        <span key={s} className="tag tag-can">
                          {s}
                        </span>
                      ))}
                      {item.can_help.length > 3 && (
                        <span className="tag-more">+{item.can_help.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onOpenProfile(item.id)}
                  >
                    Zobacz profil
                  </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-muted">
                  Nie znaleziono chłopów spełniających podane kryteria wyszukiwania.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredItems.length > 15 && (
          <div className="load-more-ledger-bar" id="load-more-rankings-bar">
            <span className="load-more-counter">
              Wyświetlono {Math.min(visibleRankingsCount, filteredItems.length)} z {filteredItems.length} pomocnych chłopów
            </span>
            <div className="load-more-btn-group">
              {visibleRankingsCount < filteredItems.length && (
                <button
                  type="button"
                  id="btn-load-more-rankings"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVisibleRankingsCount((prev) => prev + 15)}
                >
                  Wczytaj kolejnych 15 chłopów (+15)
                </button>
              )}
              {visibleRankingsCount > 15 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setVisibleRankingsCount(15)}
                >
                  Zwiń do Top 15
                </button>
              )}
              {visibleRankingsCount < filteredItems.length && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setVisibleRankingsCount(filteredItems.length)}
                >
                  Pokaż wszystkich ({filteredItems.length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Przejście do sieci Chłopchain */}
      <div className="rankings-blockchain-cta">
        <div className="cta-text">
          <strong>Chcesz zobaczyć dowody transakcji i wykopane bloki?</strong>
          <p>
            Wszystkie monety w rankingu wynikają bezpośrednio ze zweryfikowanych bloków SHA-256 w rozproszonej księdze.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onNavigate("/chlopchain")}
        >
          Otwórz księgę Chłopchain →
        </button>
      </div>
    </div>
  );
}

