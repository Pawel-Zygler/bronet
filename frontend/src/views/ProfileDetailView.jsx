import React, { useEffect, useState } from "react";
import { apiGet } from "../api";

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

  return (
    <section id="view-detail" className="view view-animate">
      <div className="detail-top">
        <a href="/" className="back-link" onClick={handleBack}>
          ← Szukaj chłopa
        </a>
      </div>

      <div className="detail-sheet">
        {loading && !profile ? (
          <p className="label-sub">Ładowanie profilu...</p>
        ) : error && !profile ? (
          <div className="empty-state">Nie znaleziono profilu ({error}).</div>
        ) : profile ? (
          <>
            <h1 className="page-title" style={{ marginBottom: 16 }}>
              Profil
            </h1>

            <div className="profile-tabs" role="tablist" aria-label="Sekcje profilu">
              {[
                { key: "skills", label: "Umiejętności" },
                { key: "contact", label: "Kontakt" },
                { key: "bio", label: "O mnie" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`profile-tab ${activeTab === tab.key ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="profile-tab-panel" hidden={activeTab !== "skills"}>
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

            <div className="profile-tab-panel" hidden={activeTab !== "contact"}>
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

            <div className="profile-tab-panel" hidden={activeTab !== "bio"}>
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

