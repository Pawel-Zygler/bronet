import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";

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

  // Kontrolki i suwaki ekonomii silnika
  const isUserInteractingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  const [minTps, setMinTps] = useState(1);
  const [maxTps, setMaxTps] = useState(5);
  const [intervalSec, setIntervalSec] = useState(1.0);
  const [dailyPoolPct, setDailyPoolPct] = useState(60);
  const [isRunning, setIsRunning] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setIsLoading(true);
    setError("");
    try {
      const data = await apiGet("/api/chlopocoin/global-stats");
      setStats(data);
      if (data && data.simulator) {
        if (!isUserInteractingRef.current) {
          if (typeof data.simulator.min_tps === "number") setMinTps(data.simulator.min_tps);
          if (typeof data.simulator.max_tps === "number") setMaxTps(data.simulator.max_tps);
          if (typeof data.simulator.interval_seconds === "number") setIntervalSec(data.simulator.interval_seconds);
          if (typeof data.simulator.daily_pool_pct === "number") setDailyPoolPct(data.simulator.daily_pool_pct);
          if (typeof data.simulator.is_running === "boolean") setIsRunning(data.simulator.is_running);
        }
      }
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err?.message || "Nie udało się pobrać statystyk sieci Chłopchain.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Odświeżanie w tle co 3 sekundy, aby ruch i transakcje TPS były widoczne na żywo
    const interval = setInterval(() => {
      fetchStats(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const sendConfigUpdate = useCallback(
    async (newConfig) => {
      setIsSavingConfig(true);
      setConfigSaveStatus("Zapisywanie...");
      try {
        await apiSend("/api/chlopocoin/simulator/config", "POST", newConfig);
        setConfigSaveStatus("✓ Zapisano");
        setTimeout(() => setConfigSaveStatus(""), 2000);
        fetchStats(false);
      } catch (err) {
        setConfigSaveStatus("Błąd zapisu!");
        setTimeout(() => setConfigSaveStatus(""), 3000);
      } finally {
        setIsSavingConfig(false);
        isUserInteractingRef.current = false;
      }
    },
    [fetchStats]
  );

  const handleSliderChange = (param, val) => {
    isUserInteractingRef.current = true;
    let newMin = minTps;
    let newMax = maxTps;
    let newInterval = intervalSec;
    let newPool = dailyPoolPct;

    if (param === "min_tps") {
      newMin = Number(val);
      if (newMin > newMax) {
        newMax = newMin;
        setMaxTps(newMin);
      }
      setMinTps(newMin);
    } else if (param === "max_tps") {
      newMax = Number(val);
      if (newMax < newMin) {
        newMin = newMax;
        setMinTps(newMax);
      }
      setMaxTps(newMax);
    } else if (param === "interval_seconds") {
      newInterval = Number(val);
      setIntervalSec(newInterval);
    } else if (param === "daily_pool_pct") {
      newPool = Number(val);
      setDailyPoolPct(newPool);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      sendConfigUpdate({
        min_tps: newMin,
        max_tps: newMax,
        interval_seconds: newInterval,
        daily_pool_pct: newPool,
      });
    }, 350);
  };

  const handleApplyPreset = (min, max, intv, pool) => {
    isUserInteractingRef.current = true;
    setMinTps(min);
    setMaxTps(max);
    setIntervalSec(intv);
    setDailyPoolPct(pool);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    sendConfigUpdate({
      min_tps: min,
      max_tps: max,
      interval_seconds: intv,
      daily_pool_pct: pool,
    });
  };

  const handleToggleRunning = async () => {
    try {
      const res = await apiSend("/api/chlopocoin/simulator/toggle", "POST");
      if (res && typeof res.is_running === "boolean") {
        setIsRunning(res.is_running);
      }
      fetchStats(false);
    } catch (_) {}
  };

  const handleResetCycle = async () => {
    if (!window.confirm("Czy na pewno chcesz zresetować cykl ekonomii do Dnia 1?")) return;
    try {
      await apiSend("/api/chlopocoin/simulator/reset-cycle", "POST");
      fetchStats(false);
    } catch (_) {}
  };

  const handleForceTick = async (count) => {
    try {
      await apiSend(`/api/chlopocoin/simulator/tick?count=${count}`, "POST");
      fetchStats(false);
    } catch (_) {}
  };

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
    <div className="chlopchain-layout" id="global-stats-container">
      {/* Mobile toggle button */}
      <div className="chlopchain-mobile-bar">
        <button
          type="button"
          id="btn-toggle-economy-sidebar"
          className="btn btn-secondary btn-sm btn-economy-drawer-toggle"
          onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
          aria-expanded={isMobileSidebarOpen}
          aria-controls="chlopchain-sidebar"
        >
          <span>🎛️ {isMobileSidebarOpen ? "Zwiń kontrolki ekonomii" : "Parametry silnika ekonomii (suwaki)"}</span>
          <span className="drawer-tps-pill">{stats?.simulator?.tps_range || `${minTps}-${maxTps} TPS`}</span>
        </button>
      </div>

      {/* Left Sidebar z kontrolkami i suwakami */}
      <aside
        className={`chlopchain-sidebar ${isMobileSidebarOpen ? "is-open" : ""}`}
        id="chlopchain-sidebar"
        aria-label="Konsola sterowania parametrami ekonomii Chłopchain"
      >
        <div className="sidebar-sticky-inner">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <span className="sidebar-badge-icon" aria-hidden="true">🎛️</span>
              <div>
                <h3 className="sidebar-title">Konsola Ekonomii</h3>
                <span className="sidebar-subtitle">Suwaki parametrów sieci</span>
              </div>
            </div>

            <div className="sidebar-status-pill">
              <span
                className={`status-dot ${isRunning ? "dot-active" : "dot-paused"}`}
                aria-hidden="true"
              />
              <span className="status-text">{isRunning ? "Praca ciągła" : "Wstrzymany"}</span>
            </div>
          </div>

          {configSaveStatus && (
            <div className="sidebar-save-alert" role="status">
              {configSaveStatus}
            </div>
          )}

          {/* Szybkie profile */}
          <div className="sidebar-section">
            <label className="sidebar-label">Szybkie profile:</label>
            <div className="preset-btn-grid">
              <button
                type="button"
                id="preset-normal"
                className="btn btn-preset"
                onClick={() => handleApplyPreset(1, 5, 1.0, 60)}
                title="Domyślne ustawienie (1-5 TPS, 1s interwał, 60% puli)"
              >
                🚗 Normalny
              </button>
              <button
                type="button"
                id="preset-turbo"
                className="btn btn-preset"
                onClick={() => handleApplyPreset(5, 15, 0.3, 60)}
                title="Szybkie transakcje (5-15 TPS, 0.3s interwał, 60% puli)"
              >
                ⚡ Turbo
              </button>
              <button
                type="button"
                id="preset-hyper"
                className="btn btn-preset"
                onClick={() => handleApplyPreset(15, 40, 0.1, 75)}
                title="Maksymalna prędkość (15-40 TPS, 0.1s interwał, 75% puli)"
              >
                🚀 Hyper
              </button>
              <button
                type="button"
                id="preset-spokojny"
                className="btn btn-preset"
                onClick={() => handleApplyPreset(1, 2, 2.5, 40)}
                title="Oszczędne tempo (1-2 TPS, 2.5s interwał, 40% puli)"
              >
                🐢 Spokojny
              </button>
            </div>
          </div>

          {/* Suwak 1: Minimalne TPS */}
          <div className="sidebar-control-group">
            <div className="slider-header">
              <label htmlFor="slider-min-tps" className="slider-label">
                Min TPS:
              </label>
              <span className="slider-val-badge" id="val-min-tps">
                {minTps} tx/s
              </span>
            </div>
            <input
              type="range"
              id="slider-min-tps"
              className="economy-range-slider"
              min="1"
              max="25"
              step="1"
              value={minTps}
              onChange={(e) => handleSliderChange("min_tps", e.target.value)}
            />
            <div className="slider-limits">
              <span>1 tx/s</span>
              <span>25 tx/s</span>
            </div>
          </div>

          {/* Suwak 2: Maksymalne TPS */}
          <div className="sidebar-control-group">
            <div className="slider-header">
              <label htmlFor="slider-max-tps" className="slider-label">
                Max TPS:
              </label>
              <span className="slider-val-badge" id="val-max-tps">
                {maxTps} tx/s
              </span>
            </div>
            <input
              type="range"
              id="slider-max-tps"
              className="economy-range-slider"
              min="1"
              max="50"
              step="1"
              value={maxTps}
              onChange={(e) => handleSliderChange("max_tps", e.target.value)}
            />
            <div className="slider-limits">
              <span>1 tx/s</span>
              <span>50 tx/s</span>
            </div>
          </div>

          {/* Suwak 3: Interwał pętli / Tempo */}
          <div className="sidebar-control-group">
            <div className="slider-header">
              <label htmlFor="slider-interval" className="slider-label">
                Interwał pętli (tempo):
              </label>
              <span className="slider-val-badge" id="val-interval">
                {intervalSec.toFixed(1)}s {intervalSec <= 0.3 ? "⚡" : intervalSec <= 1.0 ? "🚗" : "🐢"}
              </span>
            </div>
            <input
              type="range"
              id="slider-interval"
              className="economy-range-slider"
              min="0.1"
              max="3.0"
              step="0.1"
              value={intervalSec}
              onChange={(e) => handleSliderChange("interval_seconds", e.target.value)}
            />
            <div className="slider-limits">
              <span>0.1s (Turbo)</span>
              <span>3.0s (Spokojne)</span>
            </div>
          </div>

          {/* Suwak 4: Dzienny cel puli */}
          <div className="sidebar-control-group">
            <div className="slider-header">
              <label htmlFor="slider-pool-pct" className="slider-label">
                Dzienny cel puli:
              </label>
              <span className="slider-val-badge" id="val-pool-pct">
                {dailyPoolPct}%
              </span>
            </div>
            <input
              type="range"
              id="slider-pool-pct"
              className="economy-range-slider"
              min="10"
              max="90"
              step="5"
              value={dailyPoolPct}
              onChange={(e) => handleSliderChange("daily_pool_pct", e.target.value)}
            />
            <div className="slider-limits">
              <span>10% puli</span>
              <span>90% puli</span>
            </div>
          </div>

          {/* Przyciski operacyjne */}
          <div className="sidebar-actions-group">
            <button
              type="button"
              id="btn-toggle-engine"
              className={`btn btn-sm ${isRunning ? "btn-warning-outline" : "btn-primary"} btn-full`}
              onClick={handleToggleRunning}
            >
              {isRunning ? "⏸️ Wstrzymaj silnik" : "▶️ Wznów silnik"}
            </button>

            <div className="tick-force-row">
              <button
                type="button"
                id="btn-force-tick-5"
                className="btn btn-secondary btn-sm"
                onClick={() => handleForceTick(5)}
                title="Natychmiast wygeneruj +5 transakcji i wybij bloki"
              >
                🚀 +5 tx
              </button>
              <button
                type="button"
                id="btn-force-tick-25"
                className="btn btn-secondary btn-sm"
                onClick={() => handleForceTick(25)}
                title="Natychmiast wygeneruj +25 transakcji i wybij bloki"
              >
                ⚡ Turbo +25
              </button>
            </div>

            <button
              type="button"
              id="btn-reset-cycle"
              className="btn btn-outline btn-sm btn-full"
              onClick={handleResetCycle}
              title="Resetuje obecny cykl z powrotem do Dnia 1 i odnawia pulę"
            >
              🔄 Resetuj cykl (Dzień 1)
            </button>

            <button
              type="button"
              id="btn-default-config"
              className="btn btn-ghost btn-sm btn-full"
              onClick={() => handleApplyPreset(1, 5, 1.0, 60)}
            >
              ⚙️ Przywróć domyślne (1–5 TPS)
            </button>
          </div>

          {/* Mini telemetria w sidebarze */}
          <div className="sidebar-telemetry">
            <div className="telemetry-item">
              <span>Łącznie transakcji:</span>
              <strong>{stats?.simulator?.total_simulated_transactions ?? "—"}</strong>
            </div>
            <div className="telemetry-item">
              <span>Ostatni tick:</span>
              <strong>+{stats?.simulator?.last_tick_transactions ?? 0} tx</strong>
            </div>
            <div className="telemetry-item">
              <span>Cykl / Dzień:</span>
              <strong>#{stats?.simulator?.current_cycle ?? 1} / D{stats?.simulator?.current_day ?? 1}</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* Główna zawartość statystyk */}
      <div className="chlopchain-main-content global-stats-view">
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
                <span className="engine-live-text">
                  Ruch w sieci: {(stats.simulator.tps_range || "1-5 TPS").replace("-", "–")}
                </span>
              </span>
              <h2 className="engine-card-title">Silnik Obrotu Gospodarczego Chłopchain</h2>
            </div>
            <div className="engine-cycle-badge">
              Cykl #{stats.simulator.current_cycle} • Dzień {stats.simulator.current_day}
            </div>
          </div>

          <p className="engine-card-desc">
            Algorytm codziennie angażuje w pomoc <strong>{stats.simulator.daily_pool_pct || 60}% aktywnej puli profili</strong> ({stats.simulator.tps_range || "1–5 TPS"}).
            Kolejnego dnia obsługuje {stats.simulator.daily_pool_pct || 60}% z pozostałej puli, aż do jej pełnego wyczerpania i rozpoczęcia nowego cyklu.
          </p>

          <div className="engine-progress-bar-wrap">
            <div className="engine-progress-labels">
              <span>Dzisiejszy postęp pomocy (cel {stats.simulator.daily_pool_pct || 60}%):</span>
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
              <span className={`mini-val ${stats.simulator.is_running ? "status-online" : "status-paused"}`}>
                {stats.simulator.is_running
                  ? `Aktywny (${stats.simulator.tps_range || "1-5 TPS"})`
                  : "Wstrzymany (pauza)"}
              </span>
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
    </div>
  );
}

