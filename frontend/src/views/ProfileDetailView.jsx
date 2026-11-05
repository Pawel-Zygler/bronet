import React, { useEffect, useRef, useState } from "react";
import { apiGet } from "../api";

const DETAIL_TABS = [
  { key: "skills", label: "Umiejętności" },
  { key: "contact", label: "Kontakt" },
  { key: "bio", label: "O mnie" },
];

export function ProfileDetailView({
  profileId,
  cachedProfile,
  onCacheProfile,
  onBackToSearch,
  onJumpToSkillSearch,
}) {
  const [profile, setProfile] = useState(cachedProfile || null);
  const [activeTab, setActiveTab] = useState("skills");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cachedProfile);
  const tabRefs = useRef({});

  useEffect(() => {
    setActiveTab("skills");
    setError("");

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
          ← Szukaj chłopa
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
            <h1 className="page-title" id="detail-heading" style={{ marginBottom: 16 }}>
              Profil
            </h1>

            <div className="profile-tabs" role="tablist" aria-label="Sekcje profilu">
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
