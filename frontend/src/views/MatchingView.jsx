import React, { useEffect, useState } from "react";
import { apiGet } from "../api";

export function MatchingView({
  myProfile,
  isCompactView,
  onOpenProfile,
  onNavigate,
  profiles = [],
}) {
  const [activeCategory, setActiveCategory] = useState("mutual");
  const [matchesData, setMatchesData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoProfileId, setDemoProfileId] = useState(null);
  const [internalProfiles, setInternalProfiles] = useState(profiles || []);

  const allProfiles = internalProfiles.length > 0 ? internalProfiles : profiles || [];

  useEffect(() => {
    if (profiles && profiles.length > 0) {
      setInternalProfiles(profiles);
    } else {
      apiGet("/api/profiles")
        .then((list) => {
          if (Array.isArray(list)) setInternalProfiles(list);
        })
        .catch(() => {});
    }
  }, [profiles]);

  const effectiveProfileId = myProfile ? myProfile.id : demoProfileId;

  // Auto-select a demo profile if visitor is not logged in and demo profile not picked yet
  useEffect(() => {
    if (!myProfile && !demoProfileId && allProfiles && allProfiles.length > 0) {
      // Find a profile with both can_help and need_help
      const candidate = allProfiles.find(
        (p) => p.can_help && p.can_help.length > 0 && p.need_help && p.need_help.length > 0
      );
      if (candidate) {
        setDemoProfileId(candidate.id);
      }
    }
  }, [myProfile, demoProfileId, allProfiles]);

  useEffect(() => {
    if (!effectiveProfileId) {
      setMatchesData(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    apiGet(`/api/profiles/${effectiveProfileId}/matches`, controller.signal)
      .then((data) => {
        setMatchesData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Nie udało się pobrać dopasowań.");
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [effectiveProfileId]);

  const mutualMatches = matchesData ? matchesData.mutual || [] : [];
  const theyHelpMatches = matchesData ? matchesData.they_help_me || [] : [];
  const iHelpMatches = matchesData ? matchesData.i_help_them || [] : [];

  const currentList =
    activeCategory === "mutual"
      ? mutualMatches
      : activeCategory === "they_help_me"
        ? theyHelpMatches
        : iHelpMatches;

  const targetProfile = matchesData ? matchesData.profile : null;

  return (
    <section
      id="view-matching"
      className={`view view-animate ${isCompactView ? "is-compact-mode" : ""}`}
      aria-labelledby="matching-heading"
    >
      <div className={`hero ${isCompactView ? "is-compact" : ""}`}>
        <h1 className="hero-title" id="matching-heading">
          Chłop Help Auto-Matching
        </h1>
        {!isCompactView && (
          <p className="hero-subtitle">
            automatyczne dopasowanie chłopów po ich preferencjach
            <br />
            <br />
            chłop za chłopa. wymiana 1:1 bez pośredników i bez ściemy.
          </p>
        )}
      </div>

      {!myProfile && (
        <div className="matching-auth-prompt" role="region" aria-label="Wybór profilu do dopasowań">
          <div className="matching-prompt-content">
            <strong>Nie jesteś zalogowany.</strong> Zaloguj się lub załóż profil chłopa, aby
            automatycznie widzieć swoje dopasowania 1:1.
            <div className="matching-prompt-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate("/profil")}
              >
                Załóż / Otwórz swój profil
              </button>
            </div>
          </div>

          <div className="matching-demo-selector">
            <label htmlFor="demo-profile-select" className="matching-demo-label">
              Albo sprawdź dopasowania dla wybranego chłopa z bazy:
            </label>
            <select
              id="demo-profile-select"
              className="matching-select"
              value={demoProfileId || ""}
              onChange={(e) => setDemoProfileId(Number(e.target.value) || null)}
            >
              {allProfiles.length === 0 && <option value="">Ładowanie profili...</option>}
              {allProfiles.slice(0, 40).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.can_help?.slice(0, 2).join(", ") || "brak"})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {targetProfile && (
        <div className="matching-context-bar">
          <div className="matching-context-left">
            <span className="matching-context-tag">
              {myProfile && targetProfile.id === myProfile.id
                ? "Twój profil:"
                : "Dopasowania dla profilu:"}
            </span>
            <strong className="matching-context-name">{targetProfile.name}</strong>
          </div>
          <div className="matching-context-skills">
            <span title="Co oferuje">
              <strong>Umiem:</strong>{" "}
              {targetProfile.can_help?.length ? targetProfile.can_help.join(", ") : "—"}
            </span>
            <span className="sep">•</span>
            <span title="Czego szuka">
              <strong>Szukam:</strong>{" "}
              {targetProfile.need_help?.length ? targetProfile.need_help.join(", ") : "—"}
            </span>
          </div>
        </div>
      )}

      <div className="matching-category-nav" role="tablist" aria-label="Kategorie dopasowań">
        <button
          type="button"
          role="tab"
          id="tab-mutual"
          aria-selected={activeCategory === "mutual"}
          className={`matching-tab-btn ${activeCategory === "mutual" ? "is-active" : ""}`}
          onClick={() => setActiveCategory("mutual")}
        >
          🤝 Wzajemna pomoc 1:1 ({mutualMatches.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-they-help"
          aria-selected={activeCategory === "they_help_me"}
          className={`matching-tab-btn ${activeCategory === "they_help_me" ? "is-active" : ""}`}
          onClick={() => setActiveCategory("they_help_me")}
        >
          📥 Mogą pomóc ({theyHelpMatches.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-i-help"
          aria-selected={activeCategory === "i_help_them"}
          className={`matching-tab-btn ${activeCategory === "i_help_them" ? "is-active" : ""}`}
          onClick={() => setActiveCategory("i_help_them")}
        >
          📤 Możesz pomóc ({iHelpMatches.length})
        </button>
      </div>

      {isLoading ? (
        <div className="empty-state" role="status">
          Obliczanie dopasowań chłopskich...
        </div>
      ) : error ? (
        <div className="empty-state is-error" role="alert">
          {error}
        </div>
      ) : currentList.length === 0 ? (
        <div className="empty-state">
          {activeCategory === "mutual" ? (
            <>
              Brak pełnych dopasowań wzajemnych 1:1 w tym momencie.
              <br />
              Sprawdź zakładki <strong>„Mogą pomóc”</strong> lub dodaj więcej umiejętności w swoim
              profilu!
            </>
          ) : activeCategory === "they_help_me" ? (
            <>Nikt aktualnie nie oferuje umiejętności, których szukasz w sekcji „Potrzebuję”.</>
          ) : (
            <>Nikt aktualnie nie szuka umiejętności, które oferujesz w sekcji „Umiem”.</>
          )}
          {myProfile && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate("/profil")}
              >
                Edytuj swój profil
              </button>
            </div>
          )}
        </div>
      ) : isCompactView ? (
        <ul className="compact-profiles-list matching-compact-list" role="list">
          {currentList.map(({ profile, they_can_help_with, i_can_help_with }) => {
            const contactEmail =
              profile.email || (profile.contact?.includes("@") ? profile.contact.trim() : "");
            const mailSubject = encodeURIComponent(`Wymiana pomocy w Bronet`);
            const mailtoHref = contactEmail
              ? `mailto:${contactEmail}?subject=${mailSubject}`
              : null;

            return (
              <li key={profile.id} className="compact-profile-item matching-compact-item">
                <div className="compact-profile-text">
                  <a
                    href={`/profil/${profile.id}`}
                    className="compact-profile-name"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onOpenProfile(profile);
                    }}
                  >
                    {profile.name}
                  </a>
                  <span className="compact-sep"> — </span>
                  {they_can_help_with && they_can_help_with.length > 0 && (
                    <>
                      <span className="compact-label">pomoże Ci z:</span>{" "}
                      <span className="compact-skills">{they_can_help_with.join(", ")}</span>
                    </>
                  )}
                  {they_can_help_with &&
                    they_can_help_with.length > 0 &&
                    i_can_help_with &&
                    i_can_help_with.length > 0 && <span className="compact-sep">; </span>}
                  {i_can_help_with && i_can_help_with.length > 0 && (
                    <>
                      <span className="compact-label">Ty pomożesz z:</span>{" "}
                      <span className="compact-skills">{i_can_help_with.join(", ")}</span>
                    </>
                  )}
                  <span className="compact-dot">.</span>
                </div>

                <div className="compact-profile-actions">
                  {mailtoHref && (
                    <a
                      href={mailtoHref}
                      className="compact-action-btn compact-email-btn"
                      title={`Napisz e-mail do: ${profile.name}`}
                      aria-label={`Napisz do ${profile.name}`}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </a>
                  )}
                  <a
                    href={`/profil/${profile.id}`}
                    className="compact-action-btn compact-profile-link"
                    title={`Zobacz profil: ${profile.name}`}
                    aria-label={`Profil ${profile.name}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onOpenProfile(profile);
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="matching-cards-grid">
          {currentList.map(({ profile, they_can_help_with, i_can_help_with }) => {
            const isMutual =
              they_can_help_with &&
              they_can_help_with.length > 0 &&
              i_can_help_with &&
              i_can_help_with.length > 0;
            const contactEmail =
              profile.email || (profile.contact?.includes("@") ? profile.contact.trim() : "");
            const mailSubject = encodeURIComponent(
              `Wymiana pomocy w Bronet: ${they_can_help_with?.join(", ") || ""}`
            );
            const mailtoHref = contactEmail
              ? `mailto:${contactEmail}?subject=${mailSubject}`
              : null;

            return (
              <article key={profile.id} className="match-card">
                <div className="match-card-header">
                  <div>
                    <h3 className="match-card-name">
                      <a
                        href={`/profil/${profile.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          onOpenProfile(profile);
                        }}
                      >
                        {profile.name}
                      </a>
                    </h3>
                  </div>
                  {isMutual ? (
                    <span className="badge badge-mutual">🤝 Wzajemna pomoc 1:1</span>
                  ) : they_can_help_with && they_can_help_with.length > 0 ? (
                    <span className="badge badge-helps-me">Może Ci pomóc</span>
                  ) : (
                    <span className="badge badge-i-help">Możesz mu pomóc</span>
                  )}
                </div>

                <div className="match-card-exchange-box">
                  {they_can_help_with && they_can_help_with.length > 0 && (
                    <div className="match-exchange-row">
                      <span className="match-exchange-label">
                        <strong>On pomoże z:</strong>
                      </span>
                      <div className="match-exchange-tags">
                        {they_can_help_with.map((s) => (
                          <span key={s} className="skill-tag is-highlighted">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {i_can_help_with && i_can_help_with.length > 0 && (
                    <div className="match-exchange-row">
                      <span className="match-exchange-label">
                        <strong>Ty zaoferujesz:</strong>
                      </span>
                      <div className="match-exchange-tags">
                        {i_can_help_with.map((s) => (
                          <span key={s} className="skill-tag is-need-highlighted">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {profile.bio && <p className="match-card-bio">{profile.bio}</p>}

                <div className="match-card-actions">
                  {mailtoHref && (
                    <a href={mailtoHref} className="btn btn-primary match-action-btn">
                      Napisz e-mail chłopu
                    </a>
                  )}
                  <a
                    href={`/profil/${profile.id}`}
                    className="btn btn-secondary match-action-btn"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onOpenProfile(profile);
                    }}
                  >
                    Zobacz profil →
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

