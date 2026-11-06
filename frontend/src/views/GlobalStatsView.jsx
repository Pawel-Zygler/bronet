import React, { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api";

export function GlobalStatsView({ onOpenProfile, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeTab, setActiveTab] = useState("blocks"); // "blocks" | "leaderboard" | "mempool"

  // Paginacja / "Load more" dla historycznych wpisów
  const [visibleBlocksCount, setVisibleBlocksCount] = useState(15);
  const [visibleLeaderboardCount, setVisibleLeaderboardCount] = useState(10);
  const [visibleMempoolCount, setVisibleMempoolCount] = useState(10);

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setIsLoading(true);
    setError("");
    try {
      const data = await apiGet("/api/chlopocoin/global-stats");
      setStats(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err?.message || "Nie udało się pobrać statystyk sieci Chłopchain.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Odświeżanie w tle co 3 sekundy, aby ruch i transakcje 1-5 TPS były widoczne na żywo
    const interval = setInterval(() => {
      fetchStats(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("pl-PL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (_) {
      return isoStr;
    }
  };

  const truncateHash = (hash) => {
    if (!hash || hash.length <= 16) return hash || "—";
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="global-stats-view" id="global-stats-container">
      {/* Nagłówek sekcji */}
      <div className="global-stats-header">
        <div className="global-stats-title-group">
          <div className="global-stats-badge">
            <span className="chain-pulse-dot" aria-hidden="true" />
            <span>Ekonomia Blockchain • Chłopchain</span>
          </div>
          <h1 id="stats-heading">Chłopchain — Sieć Wzajemnej Pomocy</h1>
          <p className="global-stats-lead">
            Zdecentralizowana sieć wzajemnej chłopskiej pomocy. Każdy Chłopocoin (🪙 CC) powstaje
            wyłącznie w wyniku osiągnięcia <strong>konsensusu 2/2</strong> — gdy obaj chłopi
            potwierdzą pomyślną pomoc. Wszystkie transakcje są trwale i kryptograficznie zapisane
            w księdze rozproszonej SHA-256.
          </p>
        </div>

        <div className="global-stats-actions">
          <button
            type="button"
            id="btn-refresh-stats"
            className="btn btn-secondary btn-refresh-stats"
            onClick={() => fetchStats(true)}
            disabled={isLoading}
            title="Pobierz najświeższe statystyki prosto z węzła sieci"
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
            <span>{isLoading ? "Synchronizacja..." : "Odśwież dane"}</span>
          </button>
          {lastRefreshed && (
            <span className="stats-last-refreshed">
              Zsynchronizowano: {lastRefreshed.toLocaleTimeString("pl-PL")}
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

      {/* Pasek statusu integralności kryptograficznej */}
      {stats && stats.chain_integrity && (
        <div
          className={`chain-integrity-banner ${
            stats.chain_integrity.is_valid ? "is-valid" : "is-invalid"
          }`}
          id="stats-chain-integrity"
        >
          <div className="integrity-icon" aria-hidden="true">
            {stats.chain_integrity.is_valid ? "🛡️" : "⚠️"}
          </div>
          <div className="integrity-text">
            <strong>
              {stats.chain_integrity.is_valid
                ? "Integralność sieci potwierdzona kryptograficznie"
                : "Wykryto niezgodność łańcucha!"}
            </strong>
            <p>
              {stats.chain_integrity.message || stats.chain_integrity.error} • Najnowszy hasz:{" "}
              <code>{truncateHash(stats.latest_block_hash)}</code>
            </p>
          </div>
        </div>
      )}

      {/* Panel Silnika Ekonomii (Ruch w sieci 1-5 TPS & Cykl 60%) */}
      {stats && stats.simulator && (
        <div className="economy-engine-card" id="economy-engine-panel">
          <div className="engine-card-header">
            <div className="engine-title-group">
              <span className="engine-live-indicator" aria-hidden="true">
                <span className="engine-live-pulse" />
                <span className="engine-live-text">Ruch w sieci: 1–5 TPS</span>
              </span>
              <h2 className="engine-card-title">Silnik Obrotu Gospodarczego Chłopchain</h2>
            </div>
            <div className="engine-cycle-badge">
              Cykl #{stats.simulator.current_cycle} • Dzień {stats.simulator.current_day}
            </div>
          </div>

          <p className="engine-card-desc">
            Algorytm codziennie angażuje w pomoc <strong>60% aktywnej puli profili</strong> (1–5 transakcji na sekundę).
            Kolejnego dnia obsługuje 60% z pozostałej puli, aż do jej pełnego wyczerpania i rozpoczęcia nowego cyklu.
          </p>

          <div className="engine-progress-bar-wrap">
            <div className="engine-progress-labels">
              <span>Dzisiejszy postęp pomocy (cel 60%):</span>
              <strong>
                {stats.simulator.daily_served_count} / {stats.simulator.daily_target_60_pct} profili ({stats.simulator.daily_progress_pct}%)
              </strong>
            </div>
            <div
              className="engine-progress-track"
              role="progressbar"
              aria-valuenow={stats.simulator.daily_progress_pct}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                className="engine-progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(2, stats.simulator.daily_progress_pct)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="engine-metrics-row">
            <div className="engine-mini-stat">
              <span className="mini-label">Pozostało w cyklu:</span>
              <span className="mini-val">{stats.simulator.remaining_pool_count} profili</span>
            </div>
            <div className="engine-mini-stat">
              <span className="mini-label">Zrealizowano transakcji:</span>
              <span className="mini-val">{stats.simulator.total_simulated_transactions}</span>
            </div>
            <div className="engine-mini-stat">
              <span className="mini-label">Status węzła:</span>
              <span className="mini-val status-online">Aktywny (1–5 transakcji/sek)</span>
            </div>
          </div>
        </div>
      )}

      {/* Główne KPI / Metryki sieci */}
      <div className="stats-kpi-grid">
        <div className="stats-kpi-card" id="card-total-supply">
          <div className="kpi-icon-wrap coin-icon-wrap" aria-hidden="true">
            🪙
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Monety w obiegu (Supply)</span>
            <span className="kpi-value" id="global-stats-supply">
              {stats ? `${stats.total_supply} CC` : "—"}
            </span>
            <span className="kpi-subtext">Wykopane i przypisane do chłopów</span>
          </div>
        </div>

        <div className="stats-kpi-card" id="card-total-blocks">
          <div className="kpi-icon-wrap block-icon-wrap" aria-hidden="true">
            ⛓️
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Wysokość łańcucha</span>
            <span className="kpi-value" id="global-stats-blocks">
              {stats ? `${stats.total_blocks} Bloków` : "—"}
            </span>
            <span className="kpi-subtext">Zatwierdzone bloki pomocy SHA-256</span>
          </div>
        </div>

        <div className="stats-kpi-card" id="card-total-helps">
          <div className="kpi-icon-wrap help-icon-wrap" aria-hidden="true">
            🤝
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Rozliczona pomoc (2/2)</span>
            <span className="kpi-value" id="global-stats-helps">
              {stats ? stats.total_helps : "—"}
            </span>
            <span className="kpi-subtext">Udana wzajemna pomoc chłopów</span>
          </div>
        </div>

        <div className="stats-kpi-card" id="card-active-holders">
          <div className="kpi-icon-wrap user-icon-wrap" aria-hidden="true">
            👨‍🔧
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Nagrodzeni chłopi</span>
            <span className="kpi-value" id="global-stats-holders">
              {stats ? stats.active_holders_count : "—"}
            </span>
            <span className="kpi-subtext">
              {stats
                ? `z ${stats.total_profiles_count} zarejestrowanych chłopów`
                : "posiadających min. 1 CC"}
            </span>
          </div>
        </div>

        <div className="stats-kpi-card" id="card-pending-mempool">
          <div className="kpi-icon-wrap mempool-icon-wrap" aria-hidden="true">
            ⏳
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Oczekujące w Mempoolu</span>
            <span className="kpi-value" id="global-stats-pending">
              {stats ? stats.pending_confirmations_count : "—"}
            </span>
            <span className="kpi-subtext">Oczekują na drugi podpis (1/2)</span>
          </div>
        </div>
      </div>

      {/* Baner informujący o nowej dedykowanej zakładce Rankingi */}
      <div className="rankings-cta-banner">
        <div className="cta-banner-content">
          <span className="cta-banner-badge" aria-hidden="true">🏆 NOWA ZAKŁADKA</span>
          <div className="cta-banner-text">
            <strong>Szukasz rankingu najbardziej pomocnych chłopów?</strong>
            <p>Sprawdź dedykowaną zakładkę <strong>Rankingi</strong> z podium, filtrami miast i pełną listą liderów.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm btn-open-rankings"
          onClick={() => onNavigate("/rankingi")}
        >
          Otwórz Rankingi →
        </button>
      </div>

      {/* Nawigacja po podsekcjach */}
      <div className="global-stats-tabs" role="tablist" aria-label="Sekcje statystyk sieci">
        <button
          type="button"
          role="tab"
          id="tab-btn-blocks"
          aria-selected={activeTab === "blocks"}
          aria-controls="panel-stats-blocks"
          className={`global-stats-tab-btn ${activeTab === "blocks" ? "is-active" : ""}`}
          onClick={() => setActiveTab("blocks")}
        >
          Księga Bloków (Chłopchain Ledger)
          {stats && stats.blocks && <span className="tab-badge">{stats.blocks.length}</span>}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-leaderboard"
          aria-selected={activeTab === "leaderboard"}
          aria-controls="panel-stats-leaderboard"
          className={`global-stats-tab-btn ${activeTab === "leaderboard" ? "is-active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          Ranking Pomocnych Chłopów
          {stats && stats.leaderboard && (
            <span className="tab-badge">{stats.leaderboard.length}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-mempool"
          aria-selected={activeTab === "mempool"}
          aria-controls="panel-stats-mempool"
          className={`global-stats-tab-btn ${activeTab === "mempool" ? "is-active" : ""}`}
          onClick={() => setActiveTab("mempool")}
        >
          Mempool (Oczekujące na 2/2)
          {stats && (
            <span className="tab-badge">{stats.pending_confirmations_count}</span>
          )}
        </button>
      </div>

      {/* Zakładka 1: Eksplorator bloków */}
      {activeTab === "blocks" && (
        <section
          id="panel-stats-blocks"
          role="tabpanel"
          aria-labelledby="tab-btn-blocks"
          className="stats-panel"
        >
          <div className="panel-header-row">
            <div>
              <h2 className="panel-title">Księga Rozproszona (Chłopchain Block Ledger)</h2>
              <p className="panel-description">
                Wszystkie historyczne i bieżące bloki sieci wydobyte w drodze konsensusu 2/2. Każdy
                blok nagradza obu pomagających sobie chłopów po 1 Chłopocoinie.
              </p>
            </div>
            <div className="consensus-badge">
              Algorytm: <code>Proof of Chłop Help (PoCH)</code>
            </div>
          </div>

          {stats && stats.blocks && stats.blocks.length > 0 ? (
            <div className="table-responsive">
              <table className="stats-table" id="global-stats-blocks-ledger">
                <thead>
                  <tr>
                    <th>Blok</th>
                    <th>Czas wydobycia</th>
                    <th>Uczestnicy wzajemnej pomocy</th>
                    <th>Hasz bloku SHA-256</th>
                    <th>Poprzedni hasz</th>
                    <th>Nagroda</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.blocks.slice(0, visibleBlocksCount).map((b) => (
                    <tr key={b.block_index}>
                      <td className="block-index-cell">
                        <span className="badge-block-num">#{b.block_index}</span>
                      </td>
                      <td className="time-cell">{formatDate(b.created_at)}</td>
                      <td className="participants-cell">
                        <div className="participants-pair">
                          <button
                            type="button"
                            className="profile-link-btn"
                            onClick={() => onOpenProfile(b.profile_a_id)}
                          >
                            {b.profile_a_name}
                            <span className="participant-loc">({b.profile_a_location})</span>
                          </button>
                          <span className="exchange-arrow" aria-hidden="true">
                            🤝
                          </span>
                          <button
                            type="button"
                            className="profile-link-btn"
                            onClick={() => onOpenProfile(b.profile_b_id)}
                          >
                            {b.profile_b_name}
                            <span className="participant-loc">({b.profile_b_location})</span>
                          </button>
                        </div>
                      </td>
                      <td className="hash-cell">
                        <code title={b.block_hash}>{truncateHash(b.block_hash)}</code>
                      </td>
                      <td className="hash-cell">
                        <code title={b.prev_hash}>{truncateHash(b.prev_hash)}</code>
                      </td>
                      <td className="reward-cell">
                        <span className="reward-badge">+2 🪙 CC (+1/chłop)</span>
                      </td>
                      <td>
                        <span className="status-badge-settled">Konsensus 2/2 ✓</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {stats.blocks.length > 15 && (
                <div className="load-more-ledger-bar" id="load-more-blocks-bar">
                  <span className="load-more-counter">
                    Wyświetlono {Math.min(visibleBlocksCount, stats.blocks.length)} z {stats.blocks.length} bloków
                  </span>
                  <div className="load-more-btn-group">
                    {visibleBlocksCount < stats.blocks.length && (
                      <button
                        type="button"
                        id="btn-load-more-blocks"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setVisibleBlocksCount((prev) => prev + 15)}
                      >
                        Pokaż więcej bloków (+15)
                      </button>
                    )}
                    {visibleBlocksCount > 15 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setVisibleBlocksCount(15)}
                      >
                        Zwiń do 15
                      </button>
                    )}
                    {visibleBlocksCount < stats.blocks.length && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setVisibleBlocksCount(stats.blocks.length)}
                      >
                        Pokaż wszystkie ({stats.blocks.length})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="stats-empty-state">
              <div className="empty-icon">⛓️</div>
              <p>Brak bloków w łańcuchu. Pierwszy blok zostanie wykopany po potwierdzeniu pomocy!</p>
            </div>
          )}
        </section>
      )}

      {/* Zakładka 2: Ranking pomocnych chłopów */}
      {activeTab === "leaderboard" && (
        <section
          id="panel-stats-leaderboard"
          role="tabpanel"
          aria-labelledby="tab-btn-leaderboard"
          className="stats-panel"
        >
          <div className="panel-header-row">
            <div>
              <h2 className="panel-title">Ranking Najbardziej Pomocnych Chłopów</h2>
              <p className="panel-description">
                Liderzy społeczności Bronet uszeregowani według liczby wykopanych Chłopocoinów.
              </p>
            </div>
          </div>

          {stats && stats.leaderboard && stats.leaderboard.length > 0 ? (
            <div className="table-responsive">
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
                  {stats.leaderboard.slice(0, visibleLeaderboardCount).map((item, idx) => (
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
                </tbody>
              </table>

              {stats.leaderboard.length > 10 && (
                <div className="load-more-ledger-bar">
                  <span className="load-more-counter">
                    Wyświetlono {Math.min(visibleLeaderboardCount, stats.leaderboard.length)} z {stats.leaderboard.length} pozycji
                  </span>
                  <div className="load-more-btn-group">
                    {visibleLeaderboardCount < stats.leaderboard.length && (
                      <button
                        type="button"
                        id="btn-load-more-stats-leaderboard"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setVisibleLeaderboardCount((prev) => prev + 15)}
                      >
                        Pokaż kolejnych (+15)
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate("/rankingi")}
                    >
                      Otwórz pełne Rankingi →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="stats-empty-state">
              <div className="empty-icon">🪙</div>
              <p>Żaden chłop nie posiada jeszcze Chłopocoinów. Pomóż innemu chłopu i zdobądź pierwszą monetę!</p>
            </div>
          )}
        </section>
      )}

      {/* Zakładka 3: Mempool */}
      {activeTab === "mempool" && (
        <section
          id="panel-stats-mempool"
          role="tabpanel"
          aria-labelledby="tab-btn-mempool"
          className="stats-panel"
        >
          <div className="panel-header-row">
            <div>
              <h2 className="panel-title">Mempool (Pula Oczekujących Potwierdzeń)</h2>
              <p className="panel-description">
                Jednostronne deklaracje pomocy (status 1/2). Czekają na kliknięcie przycisku
                &quot;Potwierdź pomoc (Coin)&quot; przez drugiego chłopa. Po uzyskaniu konsensusu 2/2
                transakcja zostaje natychmiast wykopana jako nowy blok w sieci.
              </p>
            </div>
          </div>

          {stats && stats.mempool && stats.mempool.length > 0 ? (
            <div className="table-responsive">
              <table className="stats-table" id="global-stats-mempool">
                <thead>
                  <tr>
                    <th>Chłop zgłaszający</th>
                    <th>Chłop oczekujący na potwierdzenie</th>
                    <th>Czas zgłoszenia</th>
                    <th>Stan konsensusu</th>
                    <th>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.mempool.slice(0, visibleMempoolCount).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <button
                          type="button"
                          className="profile-link-btn"
                          onClick={() => onOpenProfile(m.from_profile_id)}
                        >
                          <strong>{m.from_name}</strong>
                          <span className="participant-loc">({m.from_location || "Polska"})</span>
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="profile-link-btn"
                          onClick={() => onOpenProfile(m.to_profile_id)}
                        >
                          <strong>{m.to_name}</strong>
                          <span className="participant-loc">({m.to_location || "Polska"})</span>
                        </button>
                      </td>
                      <td className="time-cell">{formatDate(m.created_at)}</td>
                      <td>
                        <span className="badge-pending-consensus">
                          1/2 (Oczekuje na drugi podpis)
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => onOpenProfile(m.to_profile_id)}
                        >
                          Przejdź do profilu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {stats.mempool.length > 10 && (
                <div className="load-more-ledger-bar">
                  <span className="load-more-counter">
                    Wyświetlono {Math.min(visibleMempoolCount, stats.mempool.length)} z {stats.mempool.length} oczekujących
                  </span>
                  <div className="load-more-btn-group">
                    {visibleMempoolCount < stats.mempool.length && (
                      <button
                        type="button"
                        id="btn-load-more-mempool"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setVisibleMempoolCount((prev) => prev + 10)}
                      >
                        Pokaż więcej (+10)
                      </button>
                    )}
                    {visibleMempoolCount > 10 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setVisibleMempoolCount(10)}
                      >
                        Zwiń do 10
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="stats-empty-state">
              <div className="empty-icon">✨</div>
              <p>Mempool jest pusty — wszystkie zarejestrowane pomoce zostały już rozliczone w łańcuchu!</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

