import React, { useMemo } from "react";
import { computeOverlapSet, normalizeText } from "../utils/text";

export const ProfileCard = React.memo(function ProfileCard({
  profile,
  myProfile,
  searchQuery,
  searchMode,
  onOpenProfile,
  onSelectSkill,
}) {
  const isSelf = Boolean(myProfile && profile.id === myProfile.id);

  const { myNeeds, mySkills, queryTerms, helpsMeCount, iHelpCount } = useMemo(() => {
    const needs = computeOverlapSet(myProfile ? myProfile.need_help : []);
    const skills = computeOverlapSet(myProfile ? myProfile.can_help : []);
    const terms = (searchQuery || "")
      .split(",")
      .map((t) => normalizeText(t))
      .filter(Boolean);

    let helpsMe = 0;
    let iHelp = 0;
    if (!isSelf && myProfile) {
      profile.can_help.forEach((s) => {
        if (needs.has(normalizeText(s))) helpsMe++;
      });
      profile.need_help.forEach((s) => {
        if (skills.has(normalizeText(s))) iHelp++;
      });
    }

    return {
      myNeeds: needs,
      mySkills: skills,
      queryTerms: terms,
      helpsMeCount: helpsMe,
      iHelpCount: iHelp,
    };
  }, [profile, myProfile, searchQuery, isSelf]);

  const handleOpen = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenProfile(profile);
  };

  let badge = null;
  if (isSelf) {
    badge = <span className="badge badge-self">Twój profil</span>;
  } else if (helpsMeCount > 0 && iHelpCount > 0) {
    badge = <span className="badge badge-mutual">Wzajemna pomoc 1:1</span>;
  } else if (helpsMeCount > 0) {
    badge = <span className="badge badge-helps-me">Może Ci pomóc</span>;
  } else if (iHelpCount > 0) {
    badge = <span className="badge badge-i-help">Możesz pomóc</span>;
  }

  return (
    <article className="profile-card">
      <div className="card-top">
        <div className="card-name-group">
          <a href={`/profil/${profile.id}`} className="card-name" onClick={handleOpen}>
            {profile.name}
          </a>
          {badge}
        </div>
        <a href={`/profil/${profile.id}`} className="card-open-link" onClick={handleOpen}>
          Zobacz profil →
        </a>
      </div>

      {profile.bio && <p className="card-bio">{profile.bio}</p>}

      <div className="card-row">
        <span className="card-row-label">
          <strong>Umiem</strong> (potrafię pomóc z):
        </span>
        {profile.can_help.length > 0 ? (
          profile.can_help.map((skill) => {
            const sNorm = normalizeText(skill);
            const matchesQuery =
              searchMode !== "need_help" && queryTerms.some((qt) => sNorm.includes(qt));
            const matchesNeed = !isSelf && myNeeds.has(sNorm);
            return (
              <button
                key={skill}
                type="button"
                className={`skill-tag ${matchesQuery || matchesNeed ? "is-highlighted" : ""}`}
                title={`Szukaj osób, które umieją: ${skill}`}
                onClick={() => onSelectSkill(skill, "can_help")}
              >
                {skill}
              </button>
            );
          })
        ) : (
          <span className="label-sub">brak wpisanych</span>
        )}
      </div>

      <div className="card-row">
        <span className="card-row-label">
          <strong>Potrzebuję</strong> (szukam pomocy z):
        </span>
        {profile.need_help.length > 0 ? (
          profile.need_help.map((skill) => {
            const sNorm = normalizeText(skill);
            const matchesQuery =
              searchMode !== "can_help" && queryTerms.some((qt) => sNorm.includes(qt));
            const matchesSkill = !isSelf && mySkills.has(sNorm);
            return (
              <button
                key={skill}
                type="button"
                className={`skill-tag ${matchesQuery || matchesSkill ? "is-need-highlighted" : ""}`}
                title={`Szukaj osób potrzebujących: ${skill}`}
                onClick={() => onSelectSkill(skill, "need_help")}
              >
                {skill}
              </button>
            );
          })
        ) : (
          <span className="label-sub">brak wpisanych</span>
        )}
      </div>
    </article>
  );
});

