import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiSend } from "../api";
import { mergeUniqueSkills, normalizeText } from "../utils/text";

const DEFAULT_CAN_SUGGESTIONS = ["qa", "it", "związki", "relacje męsko-damskie", "ux/ui", "finanse"];
const DEFAULT_NEED_SUGGESTIONS = ["finanse", "sdlc", "realizacja pomysłów", "it", "podatki b2b", "angielski"];

export function ProfileEditorView({
  myProfile,
  profileSyncVersion,
  initialTab,
  sessionPasswords,
  skillsCatalog,
  onSaveSessionPassword,
  onProfileSaved,
  onProfileLoggedIn,
  onLogout,
  onStatusChange,
  onSavingChange,
  onShowMobileSaveChange,
}) {
  const [editingId, setEditingId] = useState(myProfile ? myProfile.id : null);
  const isLoggedIn = Boolean(myProfile || editingId);

  const [activeTab, setActiveTab] = useState(
    initialTab || (isLoggedIn ? "skills" : "auth")
  );
  const [hasPassword, setHasPassword] = useState(Boolean(myProfile?.has_password));

  const [name, setName] = useState(myProfile?.name || "");
  const [email, setEmail] = useState(myProfile?.email || "");
  const [password, setPassword] = useState(
    myProfile && myProfile.has_password ? sessionPasswords[myProfile.id] || "" : ""
  );
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [contact, setContact] = useState(myProfile?.contact || "");
  const [bio, setBio] = useState(myProfile?.bio || "");

  const [canHelpList, setCanHelpList] = useState(myProfile?.can_help || []);
  const [needHelpList, setNeedHelpList] = useState(myProfile?.need_help || []);
  const [canHelpInput, setCanHelpInput] = useState("");
  const [needHelpInput, setNeedHelpInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const canHelpInputRef = useRef(null);
  const needHelpInputRef = useRef(null);

  const reportStatus = (message, isError = false, mobileShort = null) => {
    setFeedback({ message, isError });
    onStatusChange(message, isError, mobileShort);
  };

  useEffect(() => {
    if (myProfile) {
      setEditingId(myProfile.id);
      setHasPassword(Boolean(myProfile.has_password));
      setName(myProfile.name || "");
      setEmail(myProfile.email || "");
      setPassword(myProfile.has_password ? sessionPasswords[myProfile.id] || "" : "");
      setNewPassword("");
      setContact(myProfile.contact || "");
      setBio(myProfile.bio || "");
      setCanHelpList(myProfile.can_help || []);
      setNeedHelpList(myProfile.need_help || []);
      setCanHelpInput("");
      setNeedHelpInput("");
      setActiveTab("skills");
    } else {
      setEditingId(null);
      setHasPassword(false);
      setName("");
      setEmail("");
      setPassword("");
      setNewPassword("");
      setContact("");
      setBio("");
      setCanHelpList([]);
      setNeedHelpList([]);
      setCanHelpInput("");
      setNeedHelpInput("");
      setActiveTab("auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSyncVersion]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Show Save actions whenever logged in, on another tab (filling profile), or name is started
  const isPureLoginFront = !isLoggedIn && activeTab === "auth" && !name.trim();
  useEffect(() => {
    if (onShowMobileSaveChange) {
      onShowMobileSaveChange(!isPureLoginFront);
    }
  }, [isPureLoginFront, onShowMobileSaveChange]);

  const tabs = isLoggedIn
    ? [
        { key: "skills", label: "Umiejętności" },
        { key: "contact", label: "Kontakt" },
        { key: "bio", label: "O mnie" },
        { key: "auth", label: "Dane logowania" },
      ]
    : [
        { key: "auth", label: "Logowanie" },
        { key: "skills", label: "Umiejętności" },
        { key: "contact", label: "Kontakt" },
        { key: "bio", label: "O mnie" },
      ];

  const { availableCanSuggestions, availableNeedSuggestions } = useMemo(() => {
    const dbSkills = (skillsCatalog.all || []).map((x) => x.skill);
    const canCandidates = Array.from(new Set([...DEFAULT_CAN_SUGGESTIONS, ...dbSkills]));
    const needCandidates = Array.from(new Set([...DEFAULT_NEED_SUGGESTIONS, ...dbSkills]));

    const chosenCan = new Set(canHelpList.map(normalizeText));
    const chosenNeed = new Set(needHelpList.map(normalizeText));

    return {
      availableCanSuggestions: canCandidates
        .filter((s) => !chosenCan.has(normalizeText(s)))
        .slice(0, 7),
      availableNeedSuggestions: needCandidates
        .filter((s) => !chosenNeed.has(normalizeText(s)))
        .slice(0, 7),
    };
  }, [skillsCatalog, canHelpList, needHelpList]);

  const focusTabField = (tab, ref) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      ref.current?.focus();
    });
  };

  const commitCanHelp = () => {
    const raw = canHelpInput.trim();
    if (!raw) {
      canHelpInputRef.current?.focus();
      return;
    }
    setCanHelpList((prev) => mergeUniqueSkills(prev, raw));
    setCanHelpInput("");
    canHelpInputRef.current?.focus();
  };

  const commitNeedHelp = () => {
    const raw = needHelpInput.trim();
    if (!raw) {
      needHelpInputRef.current?.focus();
      return;
    }
    setNeedHelpList((prev) => mergeUniqueSkills(prev, raw));
    setNeedHelpInput("");
    needHelpInputRef.current?.focus();
  };

  const handleSkillChange = (value, setInput, setList) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const trailing = parts.pop() || "";
      const completed = parts.join(",");
      setList((prev) => mergeUniqueSkills(prev, completed));
      setInput(trailing.trimStart());
    } else {
      setInput(value);
    }
  };

  const handleLoginLoad = async () => {
    const cleanEmail = email.trim().toLowerCase();
    reportStatus("", false);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      reportStatus("Wpisz poprawny e-mail.", true);
      emailInputRef.current?.focus();
      return;
    }
    setIsLoggingIn(true);
    try {
      const found = await apiSend("/api/profiles/login", "POST", {
        email: cleanEmail,
        password,
      });
      if (found.has_password && password) {
        onSaveSessionPassword(found.id, password);
      }
      onProfileLoggedIn(found);
      setActiveTab("skills");
      reportStatus(`Wczytano profil „${found.name}” ✓`, false, "Wczytano ✓");
    } catch (err) {
      const msg = err.message || "Nie udało się wczytać profilu.";
      reportStatus(msg, true);
      if (msg.toLowerCase().includes("hasł")) {
        passwordInputRef.current?.focus();
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuthKeyDown = (e) => {
    if (e.key === "Enter" && isPureLoginFront) {
      e.preventDefault();
      handleLoginLoad();
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    setActiveTab("auth");
    reportStatus("Wylogowano z profilu.", false, "Wylogowano");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPureLoginFront) {
      handleLoginLoad();
      return;
    }
    reportStatus("", false);

    let nextCan = canHelpList;
    let nextNeed = needHelpList;

    if (canHelpInput.trim()) {
      nextCan = mergeUniqueSkills(nextCan, canHelpInput);
      setCanHelpList(nextCan);
      setCanHelpInput("");
    }
    if (needHelpInput.trim()) {
      nextNeed = mergeUniqueSkills(nextNeed, needHelpInput);
      setNeedHelpList(nextNeed);
      setNeedHelpInput("");
    }

    const cleanName = name.trim();
    if (!cleanName) {
      reportStatus("Podaj imię.", true);
      focusTabField("skills", nameInputRef);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      reportStatus(
        isLoggedIn
          ? "Podaj adres e-mail w zakładce Dane logowania."
          : "Podaj adres e-mail w zakładce Logowanie.",
        true
      );
      focusTabField("auth", emailInputRef);
      return;
    }

    if (editingId && hasPassword && !password) {
      reportStatus("Podaj hasło profilu w zakładce Dane logowania.", true);
      focusTabField("auth", passwordInputRef);
      return;
    }

    const payload = {
      name: cleanName,
      email: cleanEmail,
      password,
      new_password: newPassword,
      can_help: nextCan,
      need_help: nextNeed,
      contact: contact.trim(),
      bio: bio.trim(),
    };

    setIsSubmitting(true);
    onSavingChange(true);
    try {
      const wasCreating = !editingId;
      const saved = editingId
        ? await apiSend(`/api/profiles/${editingId}`, "PUT", payload)
        : await apiSend("/api/profiles", "POST", payload);

      const effectivePw = newPassword || password;
      if (saved.has_password && effectivePw) {
        onSaveSessionPassword(saved.id, effectivePw);
        setPassword(effectivePw);
      }
      setNewPassword("");
      setEditingId(saved.id);
      setHasPassword(Boolean(saved.has_password));
      if (wasCreating) {
        setActiveTab("skills");
      }

      await onProfileSaved(saved);

      reportStatus(
        saved.has_password
          ? `Zapisano profil „${saved.name}” (chroniony hasłem) ✓`
          : `Zapisano profil „${saved.name}” ✓`,
        false,
        "Zapisano ✓"
      );
    } catch (err) {
      const msg = err.message || "Nie udało się zapisać profilu.";
      reportStatus(msg, true);
      const lower = msg.toLowerCase();
      if (lower.includes("hasł")) {
        focusTabField("auth", passwordInputRef);
      } else if (lower.includes("e-mail") || lower.includes("email")) {
        focusTabField("auth", emailInputRef);
      }
    } finally {
      setIsSubmitting(false);
      onSavingChange(false);
    }
  };

  return (
    <section id="view-editor" className="view view-animate">
      <div className="editor-header-row">
        <h1 className="page-title" id="editor-heading">
          Profil
        </h1>
        {isLoggedIn && (
          <button type="button" className="text-action" onClick={handleLogoutClick}>
            Wyloguj
          </button>
        )}
      </div>

      <div className="profile-tabs" role="tablist" aria-label="Sekcje profilu">
        {tabs.map((tab) => (
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

      <form id="profile-form" className="profile-sheet" noValidate onSubmit={handleSubmit}>
        {/* Zakładka: Umiejętności (na froncie gdy zalogowany) */}
        <div className="profile-tab-panel" hidden={activeTab !== "skills"}>
          <div className="sheet-line">
            <label htmlFor="field-name" className="sheet-label">
              Imię:
            </label>
            <input
              ref={nameInputRef}
              type="text"
              id="field-name"
              name="name"
              className="inline-input"
              placeholder="wpisz imię, np. Paweł"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="sheet-block">
            <div className="sheet-line sheet-line-wrap">
              <label htmlFor="field-can-help" className="sheet-label">
                Umiem <span className="label-sub">(Potrafię pomóc z):</span>
              </label>
              <div className="inline-entry-group">
                <input
                  ref={canHelpInputRef}
                  type="text"
                  id="field-can-help"
                  className="inline-input"
                  placeholder="qa, it, związki, relacje męsko-damskie"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={canHelpInput}
                  onChange={(e) => handleSkillChange(e.target.value, setCanHelpInput, setCanHelpList)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      commitCanHelp();
                    }
                  }}
                />
                <button
                  type="button"
                  className="inline-add-btn"
                  aria-label="Dodaj umiejętność do Umiem"
                  onClick={commitCanHelp}
                >
                  Dodaj
                </button>
              </div>
            </div>

            {canHelpList.length > 0 && (
              <div className="saved-options" aria-live="polite">
                {canHelpList.map((skill, idx) => (
                  <span key={`${skill}-${idx}`} className="editable-chip">
                    {skill}
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Usuń ${skill}`}
                      onClick={() => setCanHelpList((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {availableCanSuggestions.length > 0 && (
              <div className="quick-suggestions">
                <span className="suggestion-hint">Szybki wybór:</span>
                {availableCanSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-btn"
                    onClick={() => setCanHelpList((prev) => mergeUniqueSkills(prev, s))}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sheet-block">
            <div className="sheet-line sheet-line-wrap">
              <label htmlFor="field-need-help" className="sheet-label">
                Potrzebuję <span className="label-sub">(Szukam pomocy z):</span>
              </label>
              <div className="inline-entry-group">
                <input
                  ref={needHelpInputRef}
                  type="text"
                  id="field-need-help"
                  className="inline-input"
                  placeholder="np. finanse, sdlc, realizacja pomysłów"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={needHelpInput}
                  onChange={(e) =>
                    handleSkillChange(e.target.value, setNeedHelpInput, setNeedHelpList)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      commitNeedHelp();
                    }
                  }}
                />
                <button
                  type="button"
                  className="inline-add-btn"
                  aria-label="Dodaj potrzebę do Potrzebuję"
                  onClick={commitNeedHelp}
                >
                  Dodaj
                </button>
              </div>
            </div>

            {needHelpList.length > 0 && (
              <div className="saved-options" aria-live="polite">
                {needHelpList.map((skill, idx) => (
                  <span key={`${skill}-${idx}`} className="editable-chip">
                    {skill}
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Usuń ${skill}`}
                      onClick={() => setNeedHelpList((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {availableNeedSuggestions.length > 0 && (
              <div className="quick-suggestions">
                <span className="suggestion-hint">Szybki wybór:</span>
                {availableNeedSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-btn"
                    onClick={() => setNeedHelpList((prev) => mergeUniqueSkills(prev, s))}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zakładka: Kontakt */}
        <div className="profile-tab-panel" hidden={activeTab !== "contact"}>
          <div className="sheet-line">
            <label htmlFor="field-contact" className="sheet-label">
              Kontakt <span className="label-sub">(opcjonalnie):</span>
            </label>
            <input
              type="text"
              id="field-contact"
              name="contact"
              className="inline-input"
              placeholder="np. telefon, komunikator, @nick lub dodatkowy namiar"
              maxLength={160}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
        </div>

        {/* Zakładka: O mnie */}
        <div className="profile-tab-panel" hidden={activeTab !== "bio"}>
          <div className="sheet-block">
            <label htmlFor="field-bio" className="sheet-label">
              O mnie <span className="label-sub">(opcjonalnie):</span>
            </label>
            <textarea
              id="field-bio"
              name="bio"
              rows={4}
              className="minimal-textarea"
              placeholder="kilka słów o sobie i o tym, w czym najchętniej pomożesz"
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        {/* Zakładka: Logowanie (na froncie gdy niezalogowany) / Dane logowania (na końcu gdy zalogowany) */}
        <div className="profile-tab-panel" hidden={activeTab !== "auth"}>
          <div className="sheet-line sheet-line-wrap">
            <label htmlFor="field-email" className="sheet-label">
              E-mail:
            </label>
            <div className="inline-entry-group">
              <input
                ref={emailInputRef}
                type="email"
                id="field-email"
                name="email"
                inputMode="email"
                className="inline-input"
                placeholder={
                  isLoggedIn
                    ? "twój@email.pl"
                    : "wpisz e-mail swojego profilu"
                }
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleAuthKeyDown}
              />
              {!isLoggedIn && !isPureLoginFront && (
                <button
                  type="button"
                  className="inline-add-btn"
                  title="Masz już profil na ten e-mail? Zaloguj się"
                  onClick={handleLoginLoad}
                  disabled={isLoggingIn}
                >
                  Zaloguj
                </button>
              )}
            </div>
          </div>

          <div className="sheet-line sheet-line-wrap">
            <label htmlFor="field-password" className="sheet-label">
              {!isLoggedIn ? (
                <>
                  Hasło <span className="label-sub">(opcjonalnie):</span>
                </>
              ) : hasPassword ? (
                "Hasło profilu:"
              ) : (
                <>
                  Dodaj hasło <span className="label-sub">(opcjonalnie):</span>
                </>
              )}
            </label>
            <div className="inline-entry-group">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                id="field-password"
                name="password"
                className="inline-input"
                placeholder={
                  !isLoggedIn
                    ? "wpisz hasło (jeśli profil je ma) lub ustaw nowe"
                    : hasPassword
                    ? "podaj hasło profilu, aby zapisać zmiany"
                    : "wpisz dowolne hasło, aby zabezpieczyć profil"
                }
                maxLength={200}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleAuthKeyDown}
              />
              <button
                type="button"
                className="inline-add-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Ukryj" : "Pokaż"}
              </button>
            </div>
          </div>

          {isLoggedIn && hasPassword && (
            <div className="sheet-line sheet-line-wrap">
              <label htmlFor="field-new-password" className="sheet-label">
                Nowe hasło <span className="label-sub">(opcjonalnie):</span>
              </label>
              <div className="inline-entry-group">
                <input
                  type={showPassword ? "text" : "password"}
                  id="field-new-password"
                  name="new_password"
                  className="inline-input"
                  placeholder="zostaw puste, jeśli nie zmieniasz hasła"
                  maxLength={200}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {isPureLoginFront && (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoginLoad}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Logowanie..." : "Zaloguj"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => focusTabField("skills", nameInputRef)}
              >
                Stwórz nowy profil →
              </button>
              <span
                className={`save-feedback ${feedback.isError ? "is-error" : ""}`}
                role="status"
                aria-live="polite"
              >
                {feedback.message}
              </span>
            </div>
          )}

          {isLoggedIn && (
            <div className="auth-logout-row">
              <button type="button" className="btn btn-ghost" onClick={handleLogoutClick}>
                Wyloguj
              </button>
            </div>
          )}
        </div>

        {!isPureLoginFront && (
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {editingId ? "Zapisz zmiany w profilu" : "Zapisz profil"}
            </button>
            <span
              className={`save-feedback ${feedback.isError ? "is-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {feedback.message}
            </span>
          </div>
        )}
      </form>
    </section>
  );
}
