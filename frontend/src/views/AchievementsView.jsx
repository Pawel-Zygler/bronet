import React, { useEffect, useState } from "react";
import { apiGet } from "../api";

export function AchievementsView({ myProfile, onOpenProfile, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [myAchievements, setMyAchievements] = useState(null);

  const fetchGlobalData = async () => {
    try {
      const res = await apiGet("/api/achievements/global");
      setData(res);
      setError("");
    } catch (err) {
      setError(err?.message || "Nie udało się pobrać danych osiągnięć.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAchievements = async () => {
    if (!myProfile?.id) return;
    try {
      const res = await apiGet(`/api/achievements/profile/${myProfile.id}`);
      setMyAchievements(res);
    } catch (_) {}
  };

  useEffect(() => {
    fetchGlobalData();
    fetchMyAchievements();
    const interval = setInterval(() => {
      fetchGlobalData();
      fetchMyAchievements();
    }, 10000);
    return () => clearInterval(interval);
  }, [myProfile?.id]);

  const categories = [
    { key: "all", label: "🏆 Wszystkie" },
    { key: "first_aid", label: "🩹 Pierwsza Pomoc" },
    { key: "server_first", label: "⚡ Realm Firsts" },
    { key: "economy", label: "🪙 Gospodarka" },
    { key: "social", label: "👥 Społeczność" },
    { key: "ranking", label: "📻 Rankingi" },
  ];

  const getRarityLabel = (rarity) => {
    switch (rarity) {
      case "realm_first":
        return "Realm First";
      case "legendary":
        return "Legendarne";
      case "epic":
        return "Epickie";
      case "rare":
        return "Rzadkie";
      default:
        return "Zwykłe";
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return isoStr;
    }
  };

  if (loading && !data) {
    return (
      <div className="container view-container" id="achievements-view">
        <div className="loading-state">
          <div className="spinner" aria-hidden="true" />
          <p>Wczytywanie Hali Chwały &amp; Osiągnięć Chłopchaina...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const serverFirsts = data?.serverFirsts || data?.server_firsts || [];
  const billboard = data?.billboard || {};
  const allAchievements = data?.achievements || [];
  const leaderboard = data?.leaderboard || [];
  const recentFeed = data?.recent_feed || [];

  const myUnlockedIds = new Set(
    (myAchievements?.unlocked || []).map((u) => u.id)
  );

  const filteredAchievements = allAchievements.filter((ach) => {
    const matchesCategory =
      selectedCategory === "all" || ach.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ach.title.toLowerCase().includes(q) ||
      ach.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container view-container" id="achievements-view">
      {/* ================= GŁÓWNY HERO BANNER (W STYLU HALI CHWAŁY WOW) ================= */}
      <section className="achievements-hero-card" id="achievements-hero">
        <div className="achievements-hero-glow" aria-hidden="true" />
        <div className="achievements-hero-inner">
          <div className="achievements-hero-title-group">
            <span className="achievements-crest-icon" aria-hidden="true">🏆</span>
            <div>
              <h1 className="achievements-main-heading">
                Hala Chwały &amp; Osiągnięcia
              </h1>
              <p className="achievements-hero-sub">
                Prestiżowy system odznaczeń sieci Chłopchain — zdobywaj punkty chwały,
                odblokowuj kolejne stopnie Pierwszej Pomocy i walcz o nieśmiertelne tytuły <strong>Realm First</strong>!
              </p>
            </div>
          </div>

          {/* Statystyki globalne */}
          <div className="achievements-stats-grid" id="achievements-stats-grid">
            <div className="ach-stat-chip">
              <span className="ach-stat-icon" aria-hidden="true">🎖️</span>
              <div className="ach-stat-info">
                <span className="ach-stat-value">{stats.total_unlocked_instances || 0}</span>
                <span className="ach-stat-label">Zdobytych odznaczeń</span>
              </div>
            </div>
            <div className="ach-stat-chip">
              <span className="ach-stat-icon" aria-hidden="true">💎</span>
              <div className="ach-stat-info">
                <span className="ach-stat-value">{stats.total_points_distributed || 0}</span>
                <span className="ach-stat-label">Punktów Chwały w sieci</span>
              </div>
            </div>
            <div className="ach-stat-chip">
              <span className="ach-stat-icon" aria-hidden="true">⚡</span>
              <div className="ach-stat-info">
                <span className="ach-stat-value">
                  {stats.server_firsts_claimed || 0} / {stats.server_firsts_count || 3}
                </span>
                <span className="ach-stat-label">Realm Firsts zdobyte</span>
              </div>
            </div>
            <div className="ach-stat-chip">
              <span className="ach-stat-icon" aria-hidden="true">👥</span>
              <div className="ach-stat-info">
                <span className="ach-stat-value">{stats.peasants_with_achievements || 0}</span>
                <span className="ach-stat-label">Odznaczonych chłopów</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pasek postępu zalogowanego chłopa (jeśli zalogowany) */}
        {myProfile && myAchievements && (
          <div className="my-achievements-banner" id="my-achievements-banner">
            <div className="my-ach-header">
              <span className="my-ach-title">
                Twój status chwały: <strong>{myProfile.name}</strong>
              </span>
              <span className="my-ach-points">
                ⭐ {myAchievements.total_points} Punktów Chwały ({myAchievements.unlocked_count}/{myAchievements.total_count} odblokowanych)
              </span>
            </div>
            <div className="my-ach-progress-bar-wrap">
              <div
                className="my-ach-progress-bar-fill"
                style={{ width: `${myAchievements.progress_pct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ================= ŚCIANA SŁAWY: REALM FIRSTS (PRESTIŻ SERWERA) ================= */}
      <section className="server-firsts-section" id="server-firsts-wall">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">
              ⚡ Ściana Sławy — Realm Firsts
            </h2>
            <p className="section-subtitle">
              Niepowtarzalne tytuły przyznawane tylko jednemu, pierwszemu chłopu na serwerze!
            </p>
          </div>
          <span className="badge-realm-first-legend">👑 Legendarny Prestiż</span>
        </div>

        <div className="server-firsts-grid">
          {serverFirsts.map((sf) => (
            <div
              key={sf.id}
              className={`server-first-card ${sf.is_claimed ? "is-claimed" : "is-unclaimed"}`}
              id={`sf-card-${sf.id}`}
            >
              <div className="sf-card-header">
                <div className="sf-icon-medallion" aria-hidden="true">
                  {sf.icon}
                </div>
                <div className="sf-header-texts">
                  <span className="sf-badge">⚡ SERVER FIRST</span>
                  <h3 className="sf-title">{sf.title}</h3>
                </div>
                <div className="sf-points-shield">
                  +{sf.points} <span>PKT</span>
                </div>
              </div>

              <p className="sf-desc">{sf.description}</p>

              <div className="sf-status-footer">
                {sf.is_claimed ? (
                  <div className="sf-claimer-box">
                    <span className="sf-claimed-label">✓ Zdobyte przez:</span>
                    <button
                      type="button"
                      className="sf-claimer-btn"
                      onClick={() => sf.first_achieved_by_id && onOpenProfile(sf.first_achieved_by_id)}
                      title={`Zobacz profil: ${sf.first_achieved_by_name}`}
                    >
                      👤 {sf.first_achieved_by_name || "Chłop"}
                    </button>
                    <span className="sf-claimed-date">
                      📅 {formatDate(sf.first_achieved_at)}
                    </span>
                  </div>
                ) : (
                  <div className="sf-unclaimed-box">
                    <span className="sf-unclaimed-sparkle" aria-hidden="true">✦</span>
                    <span className="sf-unclaimed-text">
                      Jeszcze nikt nie zdobył! Bądź pierwszym chłopem na serwerze!
                    </span>
                    <span className="sf-unclaimed-sparkle" aria-hidden="true">✦</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SPOTLIGHT: BILLBOARD HOT 200 ================= */}
      <section className="billboard-spotlight-card" id="billboard-spotlight">
        <div className="billboard-header">
          <span className="billboard-radio-icon" aria-hidden="true">📻</span>
          <div>
            <h3 className="billboard-title">Billboard hot 200 — Wyścig o Tron</h3>
            <p className="billboard-desc">
              Pozostań liderem #1 w rankingu pomocnych chłopów przez pełny tydzień (7 dni/cykli), aby zdobyć legendarne odznaczenie.
            </p>
          </div>
          <span className="billboard-points-pill">+150 PKT</span>
        </div>

        <div className="billboard-body">
          <div className="billboard-leader-info">
            <span className="billboard-label">Aktualny lider na szczycie listy:</span>
            {billboard.leader_id ? (
              <button
                type="button"
                className="billboard-leader-btn"
                onClick={() => onOpenProfile(billboard.leader_id)}
              >
                👑 {billboard.leader_name}
              </button>
            ) : (
              <span className="billboard-no-leader">Brak aktywnego lidera</span>
            )}
          </div>

          <div className="billboard-progress-group">
            <div className="billboard-progress-labels">
              <span>Utrzymana dominacja:</span>
              <strong>{billboard.days_held || 0} / 7 dni</strong>
            </div>
            <div className="billboard-progress-bar">
              <div
                className="billboard-progress-fill"
                style={{
                  width: `${Math.min(100, Math.round(((billboard.days_held || 0) / 7) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================= GŁÓWNA SIATKA: KATALOG OSIĄGNIĘĆ + RANKING CHWAŁY ================= */}
      <div className="achievements-main-layout">
        {/* Lewa kolumna: Katalog osiągnięć z filtrami i wyszukiwarką */}
        <div className="achievements-catalog-col">
          <div className="catalog-toolbar">
            <div className="catalog-search-wrap">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                id="achievements-search-input"
                className="form-input catalog-search-input"
                placeholder="Wyszukaj osiągnięcie (np. Pierwsza pomoc, 10 Coinów)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Zakładki kategorii */}
            <div className="category-pills-bar" role="tablist">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  id={`cat-tab-${c.key}`}
                  className={`category-pill ${selectedCategory === c.key ? "is-active" : ""}`}
                  aria-selected={selectedCategory === c.key}
                  onClick={() => setSelectedCategory(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Siatka kart osiągnięć */}
          <div className="achievements-grid" id="achievements-catalog-grid">
            {filteredAchievements.length === 0 ? (
              <div className="achievements-empty-state">
                <p>Brak osiągnięć pasujących do wybranego filtra.</p>
              </div>
            ) : (
              filteredAchievements.map((ach) => {
                const isMine = myUnlockedIds.has(ach.id);
                const rarityClass = `rarity-${ach.rarity}`;
                return (
                  <div
                    key={ach.id}
                    className={`achievement-card ${rarityClass} ${isMine ? "is-my-unlocked" : ""}`}
                    id={`ach-card-${ach.id}`}
                  >
                    <div className="ach-card-top">
                      <div className="ach-icon-box" aria-hidden="true">
                        {ach.icon}
                      </div>
                      <div className="ach-title-area">
                        <div className="ach-badges-line">
                          <span className={`ach-rarity-badge ${rarityClass}`}>
                            {getRarityLabel(ach.rarity)}
                          </span>
                          {ach.is_server_first && (
                            <span className="ach-sf-tag">⚡ Realm First</span>
                          )}
                          {isMine && (
                            <span className="ach-unlocked-tag">✓ Zdobyte przez Ciebie</span>
                          )}
                        </div>
                        <h4 className="ach-card-title">{ach.title}</h4>
                      </div>
                      <div className="ach-points-shield">
                        +{ach.points} <span className="label">PKT</span>
                      </div>
                    </div>

                    <p className="ach-card-desc">{ach.description}</p>

                    <div className="ach-card-bottom">
                      <span className="ach-global-unlocks">
                        👥 Odblokowało: {ach.unlocked_count} chłopów ({ach.unlocked_pct}%)
                      </span>
                      {ach.first_achieved_by_name && (
                        <span className="ach-first-claimer">
                          🥇 First: <strong>{ach.first_achieved_by_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Prawa kolumna: Ranking Chwały (Leaderboard) & Ostatnie odblokowania (Feed) */}
        <aside className="achievements-sidebar-col">
          {/* Tabela liderów prestiżu */}
          <div className="achievements-sidebar-card" id="achievements-leaderboard">
            <div className="sidebar-card-header">
              <h3 className="sidebar-card-title">
                🏆 Ranking Chwały
              </h3>
              <span className="sidebar-card-sub">Top chłopi wg punktów</span>
            </div>

            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <div className="sidebar-empty-state">
                  <p>Brak chłopów z odblokowanymi osiągnięciami.</p>
                </div>
              ) : (
                leaderboard.map((peasant, idx) => {
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  const isCurrent = myProfile && myProfile.id === peasant.id;
                  return (
                    <div
                      key={peasant.id}
                      className={`leaderboard-item ${isCurrent ? "is-current-user" : ""}`}
                      onClick={() => onOpenProfile(peasant.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="leaderboard-rank">{medal}</span>
                      <div className="leaderboard-details">
                        <span className="leaderboard-name">{peasant.name}</span>
                        <span className="leaderboard-loc">📍 {peasant.location_name} • 🪙 {peasant.chlopocoin_balance} CC</span>
                      </div>
                      <div className="leaderboard-score">
                        <span className="leaderboard-pts">⭐ {peasant.achievement_points}</span>
                        <span className="leaderboard-badges">{peasant.achievements_count} odznak</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ostatnie odblokowania (Live ticker) */}
          <div className="achievements-sidebar-card" id="achievements-recent-feed">
            <div className="sidebar-card-header">
              <h3 className="sidebar-card-title">
                ⚡ Ostatnie Odblokowania
              </h3>
              <span className="sidebar-card-sub">Na żywo z sieci</span>
            </div>

            <div className="recent-feed-list">
              {recentFeed.length === 0 ? (
                <div className="sidebar-empty-state">
                  <p>Cisza na tablicy chwały.</p>
                </div>
              ) : (
                recentFeed.map((item, idx) => (
                  <div key={idx} className="recent-feed-item">
                    <span className="recent-feed-icon" aria-hidden="true">{item.icon}</span>
                    <div className="recent-feed-body">
                      <div className="recent-feed-line">
                        <button
                          type="button"
                          className="recent-feed-peasant"
                          onClick={() => onOpenProfile(item.profile_id)}
                        >
                          {item.profile_name}
                        </button>
                        <span className="recent-feed-action">zdobył</span>
                      </div>
                      <span className="recent-feed-title">„{item.title}” (+{item.points} pkt)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

