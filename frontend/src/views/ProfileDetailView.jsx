import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";

const DETAIL_TABS = [
  { key: "skills", label: "Umiejętności" },
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
}) {
  const [profile, setProfile] = useState(cachedProfile || null);
  const [activeTab, setActiveTab] = useState("skills");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cachedProfile);
  const tabRefs = useRef({});

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

      // Odśwież stan oglądanego profilu (jeśli dostał coin)
      apiGet(`/api/profiles/${profile.id}`)
        .then((fresh) => {
          setProfile(fresh);
          onCacheProfile(fresh);
        })
        .catch(() => {});

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
              <h1 className="page-title" id="detail-heading" style={{ margin: 0 }}>
                {profile.name}
              </h1>
              <div
                className="profile-coin-pill"
                id="detail-coin-pill"
                title="Stan konta Chłopocoinów za udaną pomoc braterską"
              >
                🪙 <strong id="detail-profile-coins">{profile.chlopocoin_balance || 0}</strong> CC
              </div>
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
