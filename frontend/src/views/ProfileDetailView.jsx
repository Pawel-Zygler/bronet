import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";

const DETAIL_TABS = [
  { key: "skills", label: "Umiejętności" },
  { key: "wallet", label: "🪙 Portfel Coinów" },
  { key: "contact", label: "Kontakt" },
  { key: "bio", label: "O mnie" },
];

export function ProfileDetailView({
  profileId,
  cachedProfile,
  myProfile,
  sessionPasswords = {},
  onCacheProfile,
  onBackToSearch,
  onJumpToSkillSearch,
  onRefreshMyProfile,
  onOpenProfile,
  onNavigate,
}) {
  const [profile, setProfile] = useState(cachedProfile || null);
  const [activeTab, setActiveTab] = useState("skills");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cachedProfile);
  const tabRefs = useRef({});

  // Portfel Chłopocoinów & Księga Bloków tego profilu
  const [walletStats, setWalletStats] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [visibleWalletBlocksCount, setVisibleWalletBlocksCount] = useState(6);

  // Chłopocoin (ekonomia wzajemnej pomocy 2/2)
  const [coinStatus, setCoinStatus] = useState({
    confirmed_by_me: false,
    confirmed_by_them: false,
    mutual_settled: false,
    block_index: null,
    block_hash: null,
  });
  const [isConfirmingCoin, setIsConfirmingCoin] = useState(false);
  const [coinMessage, setCoinMessage] = useState("");

  const isOtherProfile = Boolean(myProfile && myProfile.id && profile && profile.id && myProfile.id !== profile.id);

  // Pobranie profilu
  useEffect(() => {
    setActiveTab("skills");
    setError("");
    setCoinMessage("");

    if (cachedProfile && cachedProfile.id === profileId) {
      setProfile(cachedProfile);
      setLoading(false);
    } else {
      setProfile(null);
      setLoading(true);
    }

    const controller = new AbortController();
    apiGet(`/api/profiles/${profileId}`, controller.signal)
      .then((fresh) => {
        setProfile(fresh);
        onCacheProfile(fresh);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (!cachedProfile) {
          setError(err.message || "Nie znaleziono profilu.");
        }
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Pobranie statusu potwierdzenia Chłopocoina między mną a oglądanym profilem
  useEffect(() => {
    if (!isOtherProfile) return;

    let mounted = true;
    apiGet(`/api/profiles/${myProfile.id}/chlopocoin-status?other_id=${profile.id}`)
      .then((data) => {
        if (mounted && data) {
          setCoinStatus(data);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [isOtherProfile, myProfile?.id, profile?.id]);

  const fetchWalletStats = (idToFetch) => {
    const pid = idToFetch || profileId || profile?.id;
    if (!pid) return;
    setLoadingWallet(true);
    apiGet(`/api/profiles/${pid}/chlopocoin-stats`)
      .then((data) => {
        setWalletStats(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingWallet(false);
      });
  };

  useEffect(() => {
    fetchWalletStats(profileId);
  }, [profileId]);

  // Akcja potwierdzenia pomocy i przyznania Chłopocoina (konsensus 2/2)
  const handleConfirmHelp = async () => {
    if (!myProfile || !profile) return;
    setIsConfirmingCoin(true);
    setCoinMessage("");

    try {
      const pwd = sessionPasswords[myProfile.id] || "";
      const res = await apiSend(`/api/profiles/${myProfile.id}/confirm-help`, "POST", {
        other_profile_id: profile.id,
        password: pwd,
      });

      setCoinMessage(res.message || "Potwierdzenie zapisane.");
      setCoinStatus((prev) => ({
        ...prev,
        confirmed_by_me: true,
        mutual_settled: Boolean(res.mutual_settled),
        block_index: res.block_index || prev.block_index,
        block_hash: res.block_hash || prev.block_hash,
      }));

      // Odśwież stan oglądanego profilu i portfela (jeśli dostał coin)
      apiGet(`/api/profiles/${profile.id}`)
        .then((fresh) => {
          setProfile(fresh);
          onCacheProfile(fresh);
        })
        .catch(() => {});

      fetchWalletStats(profile.id);

      if (onRefreshMyProfile) {
        onRefreshMyProfile();
      }
    } catch (err) {
      setCoinMessage(err.message || "Nie udało się potwierdzić pomocy.");
    } finally {
      setIsConfirmingCoin(false);
    }
  };

  const handleBack = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onBackToSearch();
  };

  const handleTabKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % DETAIL_TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + DETAIL_TABS.length) % DETAIL_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = DETAIL_TABS.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const nextKey = DETAIL_TABS[nextIdx].key;
      setActiveTab(nextKey);
      tabRefs.current[nextKey]?.focus();
    }
  };

  return (
    <section id="view-detail" className="view view-animate" aria-labelledby="detail-heading">
      <div className="detail-top">
        <a href="/" className="back-link" onClick={handleBack}>
          ← Szukaj
        </a>
      </div>

      <div className="detail-sheet">
        {loading && !profile ? (
          <p className="label-sub" role="status" aria-live="polite">
            Ładowanie profilu...
          </p>
        ) : error && !profile ? (
          <div className="empty-state" role="alert">
            Nie znaleziono profilu ({error}).
          </div>
        ) : profile ? (
          <>
            <div className="profile-detail-header-row">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 className="page-title" id="detail-heading" style={{ margin: 0 }}>
                  {profile.name}
                </h1>
                {profile.role === "admin" || profile.email?.trim().toLowerCase() === "pawel.zygler@gmail.com" ? (
                  <span className="badge-role-admin" id="detail-role-badge">🛡️ Admin</span>
                ) : (
                  <span className="badge-role-user" id="detail-role-badge">Chłop</span>
                )}
                {isOtherProfile && (
                  <button
                    type="button"
                    id="btn-profile-send-dm"
                    className="btn btn-secondary btn-sm profile-dm-btn"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("bronet_open_dm", {
                          detail: {
                            id: profile.id,
                            name: profile.name,
                            location_name: profile.location_name,
                          },
                        })
                      );
                    }}
                    title={`Napisz prywatną wiadomość do ${profile.name}`}
                  >
                    ✉️ Napisz na priv
                  </button>
                )}
              </div>
              <button
                type="button"
                className="profile-coin-pill clickable-pill"
                id="detail-coin-pill"
                onClick={() => setActiveTab("wallet")}
                title="Kliknij, aby otworzyć portfel i historię bloków Chłopchain tego profilu"
              >
                🪙 <strong id="detail-profile-coins">{walletStats?.balance ?? profile.chlopocoin_balance ?? 0}</strong> CC
              </button>
            </div>

            {/* Panel Chłopocoinów (Gdy jesteś zalogowany i oglądasz profil innego chłopa) */}
            {isOtherProfile && (
              <div className="chlopocoin-action-card" id="chlopocoin-action-box" role="region" aria-label="Wymiana Chłopocoina">
                <div className="chlopocoin-card-header">
                  <span className="coin-icon-spin" aria-hidden="true">🪙</span>
                  <div>
                    <h4 className="chlopocoin-card-title">Chłopocoin — Wzajemna Pomoc (Chłopchain)</h4>
                    <p className="chlopocoin-card-desc">
                      Ekonomia blockchain: gdy obaj przyciśniecie coina na swoich profilach, sieć zatwierdza blok i obaj otrzymujecie po <strong>+1 Chłopocoinie (CC)</strong>!
                    </p>
                  </div>
                </div>

                {coinStatus.mutual_settled ? (
                  <div className="chlopocoin-status-box settled" id="chlopocoin-settled-box">
                    <span className="badge badge-success">✓ Chłopocoin przyznany obu profilom (2/2)</span>
                    <div className="blockchain-hash-info">
                      Blok Chłopchain #{coinStatus.block_index}: <code className="block-hash">{coinStatus.block_hash ? `${coinStatus.block_hash.slice(0, 18)}...` : ""}</code>
                    </div>
                    <p className="coin-hint-text">
                      Wymiana pomocy z <strong>{profile.name}</strong> została trwale zapisana w księdze bloków!
                    </p>
                  </div>
                ) : coinStatus.confirmed_by_me && !coinStatus.confirmed_by_them ? (
                  <div className="chlopocoin-status-box pending" id="chlopocoin-pending-box">
                    <span className="badge badge-warning">⏳ Twoje potwierdzenie zapisane (1/2)</span>
                    <p className="coin-hint-text">
                      Czekamy na potwierdzenie od chłopa <strong>{profile.name}</strong>. Gdy wejdzie na Twój profil i kliknie coina, konsensus zostanie osiągnięty!
                    </p>
                    <button
                      type="button"
                      id="btn-grant-chlopocoin"
                      className="btn btn-secondary btn-sm"
                      disabled
                    >
                      🪙 Potwierdzone z Twojej strony ✓
                    </button>
                  </div>
                ) : !coinStatus.confirmed_by_me && coinStatus.confirmed_by_them ? (
                  <div className="chlopocoin-status-box ready" id="chlopocoin-ready-box">
                    <span className="badge badge-mutual">🔥 {profile.name} już potwierdził pomoc z Tobą!</span>
                    <p className="coin-hint-text">
                      Kliknij poniżej, aby dobić targu (2/2) i wybić po 1 Chłopocoinie dla Was obu!
                    </p>
                    <button
                      type="button"
                      id="btn-grant-chlopocoin"
                      className="btn btn-primary btn-sm btn-chlopocoin"
                      disabled={isConfirmingCoin}
                      onClick={handleConfirmHelp}
                    >
                      {isConfirmingCoin ? "Wybijanie bloku w blockchainie..." : "🪙 Przyznaj Chłopocoina i odbierz swój (2/2)"}
                    </button>
                  </div>
                ) : (
                  <div className="chlopocoin-status-box initial" id="chlopocoin-initial-box">
                    <p className="coin-hint-text">
                      Pomogliście sobie z tym chłopem? Potwierdź udaną pomoc, aby uruchomić konsensus Chłopchain.
                    </p>
                    <button
                      type="button"
                      id="btn-grant-chlopocoin"
                      className="btn btn-primary btn-sm btn-chlopocoin"
                      disabled={isConfirmingCoin}
                      onClick={handleConfirmHelp}
                    >
                      {isConfirmingCoin ? "Zapisywanie potwierdzenia..." : "🪙 Przyznaj Chłopocoina (Potwierdź pomoc)"}
                    </button>
                  </div>
                )}

                {coinMessage && (
                  <p className="chlopocoin-msg-feedback" role="status" aria-live="polite">
                    {coinMessage}
                  </p>
                )}
              </div>
            )}

            <div className="profile-tabs" role="tablist" aria-label="Sekcje profilu" style={{ marginTop: 20 }}>
              {DETAIL_TABS.map((tab, idx) => {
                const isSelected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    ref={(el) => {
                      tabRefs.current[tab.key] = el;
                    }}
                    id={`detail-tab-${tab.key}`}
                    type="button"
                    role="tab"
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-controls={`detail-panel-${tab.key}`}
                    className={`profile-tab ${isSelected ? "is-active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              id="detail-panel-skills"
              role="tabpanel"
              aria-labelledby="detail-tab-skills"
              className="profile-tab-panel"
              hidden={activeTab !== "skills"}
            >
              <div className="detail-line" style={{ margin: 0 }}>
                <strong>Imię:</strong> {profile.name}
              </div>

              {profile.location_name && (
                <div className="detail-line" style={{ margin: 0 }}>
                  <strong>Lokalizacja:</strong> 📍 {profile.location_name}
                </div>
              )}

              <div className="detail-line" style={{ margin: 0 }}>
                <strong>Umiem</strong> <span className="label-sub">(Potrafię pomóc z):</span>
                <div style={{ marginTop: 6 }}>
                  {profile.can_help.length > 0 ? (
                    profile.can_help.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="skill-tag"
                        aria-label={`Szukaj osób, które umieją: ${s}`}
                        onClick={() => onJumpToSkillSearch(s, "can_help")}
                      >
                        {s}
                      </button>
                    ))
                  ) : (
                    <span className="label-sub">brak wpisanych opcji</span>
                  )}
                </div>
              </div>

              <div className="detail-line" style={{ margin: 0 }}>
                <strong>Potrzebuję</strong> <span className="label-sub">(Szukam pomocy z):</span>
                <div style={{ marginTop: 6 }}>
                  {profile.need_help.length > 0 ? (
                    profile.need_help.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="skill-tag"
                        aria-label={`Szukaj osób potrzebujących: ${s}`}
                        onClick={() => onJumpToSkillSearch(s, "need_help")}
                      >
                        {s}
                      </button>
                    ))
                  ) : (
                    <span className="label-sub">brak wpisanych opcji</span>
                  )}
                </div>
              </div>
            </div>

            {/* Zakładka 2: Portfel Coinów i Blockchain Dashboard */}
            <div
              id="detail-panel-wallet"
              role="tabpanel"
              aria-labelledby="detail-tab-wallet"
              className="profile-tab-panel"
              hidden={activeTab !== "wallet"}
            >
              <div className="stats-hero-card" id="detail-wallet-hero">
                <div className="stats-hero-icon" aria-hidden="true">🪙</div>
                <div className="stats-hero-info">
                  <div className="stats-hero-label">Portfel w sieci Chłopchain:</div>
                  <div className="stats-hero-balance">
                    <span id="detail-wallet-balance" className="coin-balance-big">
                      {walletStats?.balance ?? profile.chlopocoin_balance ?? 0}
                    </span>
                    <span className="coin-currency">Chłopocoinów (CC)</span>
                  </div>
                  <p className="stats-hero-sub">
                    Zdecentralizowany portfel chłopski. Każdy Chłopocoin (🪙 CC) w portfelu chłopa <strong>{profile.name}</strong> pochodzi z pomyślnie zrealizowanej pomocy między braćmi (Proof of Chłop Help — autentyczny konsensus 2/2).
                  </p>
                </div>
              </div>

              <div className="stats-metrics-grid" id="detail-wallet-metrics">
                <div className="stat-metric-card">
                  <div className="metric-val" id="detail-metric-balance">
                    🪙 {walletStats?.balance ?? profile.chlopocoin_balance ?? 0} CC
                  </div>
                  <div className="metric-desc">Saldo Chłopocoinów</div>
                </div>

                <div className="stat-metric-card">
                  <div className="metric-val" id="detail-metric-completed">
                    🤝 {walletStats?.completed_helps ?? walletStats?.blocks?.length ?? 0}
                  </div>
                  <div className="metric-desc">Wykopane bloki (Wymiany 2/2)</div>
                </div>

                <div className="stat-metric-card">
                  <div className="metric-val" id="detail-metric-pending">
                    ⏳ {walletStats?.waiting_for_them_count ?? 0}
                  </div>
                  <div className="metric-desc">Czeka na potwierdzenie</div>
                </div>
              </div>

              {/* Księga Rozproszona wykopanych bloków tego chłopa */}
              <div className="stats-blockchain-ledger" id="detail-blocks-ledger">
                <div className="ledger-header-flex">
                  <h4 className="ledger-title">
                    ⛓️ Księga Rozproszona Chłopchain ({walletStats?.blocks?.length ?? 0} bloków)
                  </h4>
                  <a
                    href="/chlopchain"
                    className="ledger-global-link"
                    onClick={(e) => {
                      if (onNavigate) {
                        e.preventDefault();
                        onNavigate("/chlopchain");
                      }
                    }}
                  >
                    Zobacz całą sieć Chłopchain →
                  </a>
                </div>

                {loadingWallet ? (
                  <p className="label-sub">Synchronizacja bloków z łańcuchem...</p>
                ) : walletStats?.blocks && walletStats.blocks.length > 0 ? (
                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Blok</th>
                          <th>Partner w pomocy</th>
                          <th>Hash bloku (SHA-256)</th>
                          <th>Data</th>
                          <th>Nagroda</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletStats.blocks.slice(0, visibleWalletBlocksCount).map((b) => (
                          <tr key={b.block_index} id={`detail-block-row-${b.block_index}`}>
                            <td><strong>#{b.block_index}</strong></td>
                            <td>
                              {b.partner_id && onOpenProfile ? (
                                <button
                                  type="button"
                                  className="chat-author-btn"
                                  onClick={() => onOpenProfile({ id: b.partner_id, name: b.partner_name })}
                                >
                                  {b.partner_name}
                                </button>
                              ) : (
                                <span>{b.partner_name}</span>
                              )}
                            </td>
                            <td>
                              <code className="block-hash" title={b.block_hash}>
                                {b.block_hash ? `${b.block_hash.slice(0, 16)}...` : "—"}
                              </code>
                            </td>
                            <td>{b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                            <td><span className="badge badge-success">+1 🪙 CC</span></td>
                            <td><span className="badge badge-mutual">Konsensus 2/2 ✓</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {walletStats.blocks.length > 6 && (
                      <div className="load-more-ledger-bar">
                        <span className="load-more-counter">
                          Wyświetlono {Math.min(visibleWalletBlocksCount, walletStats.blocks.length)} z {walletStats.blocks.length} wykopanych bloków
                        </span>
                        <div className="load-more-btn-group">
                          {visibleWalletBlocksCount < walletStats.blocks.length && (
                            <button
                              type="button"
                              id="btn-load-more-detail-blocks"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setVisibleWalletBlocksCount((prev) => prev + 6)}
                            >
                              Pokaż więcej bloków (+6)
                            </button>
                          )}
                          {visibleWalletBlocksCount < walletStats.blocks.length && (
                            <button
                              type="button"
                              id="btn-load-all-detail-blocks"
                              className="btn btn-outline btn-sm"
                              onClick={() => setVisibleWalletBlocksCount(walletStats.blocks.length)}
                            >
                              Pokaż wszystkie ({walletStats.blocks.length})
                            </button>
                          )}
                          {visibleWalletBlocksCount > 6 && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setVisibleWalletBlocksCount(6)}
                            >
                              Zwiń do 6
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ledger-empty-box" id="detail-wallet-empty">
                    <p className="ledger-empty-title">
                      Brak wykopanych bloków w portfelu tego chłopa.
                    </p>
                    <p className="label-sub">
                      Gdy {profile.name} pomoże innemu chłopu i po udanej pomocy <strong>obaj potwierdzą to na profilu</strong>, Chłopchain wykopie blok i nagrodzi obu chłopów monetami CC!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              id="detail-panel-contact"
              role="tabpanel"
              aria-labelledby="detail-tab-contact"
              className="profile-tab-panel"
              hidden={activeTab !== "contact"}
            >
              {profile.email ? (
                <div className="detail-contact-box" style={{ marginTop: 0 }}>
                  <strong>E-mail:</strong>{" "}
                  <a href={`mailto:${profile.email}`} style={{ textDecoration: "underline" }}>
                    {profile.email}
                  </a>
                  {profile.contact && profile.contact !== profile.email && (
                    <div style={{ marginTop: 6 }}>
                      <strong>Kontakt:</strong> {profile.contact}
                    </div>
                  )}
                </div>
              ) : profile.contact ? (
                <div className="detail-contact-box" style={{ marginTop: 0 }}>
                  <strong>Kontakt:</strong> {profile.contact}
                </div>
              ) : (
                <span className="label-sub">brak wpisanych danych kontaktowych</span>
              )}

              {isOtherProfile && (
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    id="btn-contact-send-dm"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("bronet_open_dm", {
                          detail: {
                            id: profile.id,
                            name: profile.name,
                            location_name: profile.location_name,
                          },
                        })
                      );
                    }}
                  >
                    ✉️ Napisz wiadomość prywatną do {profile.name}
                  </button>
                </div>
              )}
            </div>

            <div
              id="detail-panel-bio"
              role="tabpanel"
              aria-labelledby="detail-tab-bio"
              className="profile-tab-panel"
              hidden={activeTab !== "bio"}
            >
              {profile.bio ? (
                <p className="detail-bio-text">{profile.bio}</p>
              ) : (
                <span className="label-sub">brak opisu</span>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
