import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";
import { POPULAR_CITIES, findCityCoords } from "../utils/cities";
import { isFemaleName, mergeUniqueSkills, normalizeText } from "../utils/text";

const DEFAULT_CAN_SUGGESTIONS = ["qa", "it", "związki", "relacje męsko-damskie", "ux/ui", "finanse"];
const DEFAULT_NEED_SUGGESTIONS = ["finanse", "sdlc", "realizacja pomysłów", "it", "podatki b2b", "angielski"];

const EDITOR_TABS = [
  { key: "skills", label: "Umiejętności" },
  { key: "location", label: "Lokalizacja" },
  { key: "contact", label: "Kontakt" },
  { key: "bio", label: "O mnie" },
  { key: "stats", label: "Statystyki" },
  { key: "auth", label: "Dane logowania" },
];

export function ProfileEditorView({
  myProfile,
  profileSyncVersion,
  sessionPasswords,
  skillsCatalog,
  onSaveSessionPassword,
  onProfileSaved,
  onProfileLoggedIn,
  onProfileDeleted,
  onLogout,
  onStatusChange,
  onSavingChange,
  onShowMobileSaveChange,
}) {
  const [editingId, setEditingId] = useState(myProfile ? myProfile.id : null);
  const isLoggedIn = Boolean(myProfile || editingId);

  // When logged out: "login" (dedicated front login form) or "create" (new profile form)
  const [unauthMode, setUnauthMode] = useState("login");
  const [autoCreateEmail, setAutoCreateEmail] = useState("");
  const [activeTab, setActiveTab] = useState("skills");
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
  const [locationName, setLocationName] = useState(myProfile?.location_name || "");
  const [lat, setLat] = useState(myProfile?.lat ?? null);
  const [lng, setLng] = useState(myProfile?.lng ?? null);
  const [shareLocation, setShareLocation] = useState(Boolean(myProfile?.share_location));
  const [isGettingGps, setIsGettingGps] = useState(false);

  const [canHelpList, setCanHelpList] = useState(myProfile?.can_help || []);
  const [needHelpList, setNeedHelpList] = useState(myProfile?.need_help || []);
  const [canHelpInput, setCanHelpInput] = useState("");
  const [needHelpInput, setNeedHelpInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [forceShowDeletePw, setForceShowDeletePw] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  const formRef = useRef(null);
  const tabRefs = useRef({});
  const loginEmailRef = useRef(null);
  const loginPasswordRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const canHelpInputRef = useRef(null);
  const needHelpInputRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const deletePwInputRef = useRef(null);
  const deleteConfirmBtnRef = useRef(null);

  // Chłopocoin stats
  const [chlopocoinStats, setChlopocoinStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (activeTab === "stats" && editingId) {
      setLoadingStats(true);
      apiGet(`/api/profiles/${editingId}/chlopocoin-stats`)
        .then((data) => {
          setChlopocoinStats(data);
          setLoadingStats(false);
        })
        .catch(() => {
          setLoadingStats(false);
        });
    }
  }, [activeTab, editingId]);

  const reportStatus = (message, isError = false, mobileShort = null, badField = "") => {
    setInvalidField(isError ? badField : "");
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
      setLocationName(myProfile.location_name || "");
      setLat(myProfile.lat ?? null);
      setLng(myProfile.lng ?? null);
      setShareLocation(Boolean(myProfile.share_location));
      setCanHelpList(myProfile.can_help || []);
      setNeedHelpList(myProfile.need_help || []);
      setCanHelpInput("");
      setNeedHelpInput("");
      setActiveTab("skills");
      setInvalidField("");
      setConfirmingDelete(false);
      setDeletePassword("");
      setForceShowDeletePw(false);
      setDeleteError("");
      setAutoCreateEmail("");
    } else {
      setEditingId(null);
      setHasPassword(false);
      setName("");
      setEmail("");
      setPassword("");
      setNewPassword("");
      setContact("");
      setBio("");
      setLocationName("");
      setLat(null);
      setLng(null);
      setShareLocation(false);
      setCanHelpList([]);
      setNeedHelpList([]);
      setCanHelpInput("");
      setNeedHelpInput("");
      setUnauthMode("login");
      setAutoCreateEmail("");
      setActiveTab("skills");
      setInvalidField("");
      setConfirmingDelete(false);
      setDeletePassword("");
      setForceShowDeletePw(false);
      setDeleteError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSyncVersion]);

  const showLoginFront = !isLoggedIn && unauthMode === "login";

  useEffect(() => {
    if (onShowMobileSaveChange) {
      onShowMobileSaveChange(!showLoginFront);
    }
  }, [showLoginFront, onShowMobileSaveChange]);

  // Focus first field when opening dedicated login front
  useEffect(() => {
    if (showLoginFront) {
      requestAnimationFrame(() => {
        loginEmailRef.current?.focus();
      });
    }
  }, [showLoginFront]);

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

  const handleTabKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % EDITOR_TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + EDITOR_TABS.length) % EDITOR_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = EDITOR_TABS.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const nextKey = EDITOR_TABS[nextIdx].key;
      setActiveTab(nextKey);
      tabRefs.current[nextKey]?.focus();
    }
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

  const executeLogin = async (emailRefToFocus, pwRefToFocus) => {
    const cleanEmail = email.trim().toLowerCase();
    reportStatus("", false);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      reportStatus("Wpisz poprawny adres e-mail.", true, "Podaj e-mail", "email");
      emailRefToFocus.current?.focus();
      return;
    }
    if (!password) {
      reportStatus("Podaj hasło.", true, "Podaj hasło", "password");
      pwRefToFocus.current?.focus();
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
      setAutoCreateEmail("");
      setActiveTab("skills");
      reportStatus(`Zalogowano do profilu „${found.name}” ✓`, false, "Zalogowano ✓");
    } catch (err) {
      if (err && err.status === 404) {
        setEmail(cleanEmail);
        setAutoCreateEmail(cleanEmail);
        setUnauthMode("create");
        setActiveTab("skills");
        reportStatus("", false);
        requestAnimationFrame(() => {
          nameInputRef.current?.focus();
        });
        return;
      }
      const msg = err.message || "Nie udało się zalogować.";
      const isPwErr = msg.toLowerCase().includes("hasł");
      reportStatus(msg, true, null, isPwErr ? "password" : "email");
      if (isPwErr) {
        pwRefToFocus.current?.focus();
      } else {
        emailRefToFocus.current?.focus();
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLoginFormSubmit = (e) => {
    e.preventDefault();
    executeLogin(loginEmailRef, loginPasswordRef);
  };

  const handleStartCreate = () => {
    reportStatus("", false);
    setAutoCreateEmail("");
    setUnauthMode("create");
    setActiveTab("skills");
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  };

  const handleBackToLogin = () => {
    reportStatus("", false);
    setAutoCreateEmail("");
    setUnauthMode("login");
    requestAnimationFrame(() => {
      loginEmailRef.current?.focus();
    });
  };

  const handleLogoutClick = () => {
    onLogout();
    setUnauthMode("login");
    reportStatus("Wylogowano z profilu.", false, "Wylogowano");
  };

  const handleOpenDeleteConfirm = () => {
    reportStatus("", false);
    setDeleteError("");
    const initialPw = password || "";
    setDeletePassword(initialPw);
    setForceShowDeletePw(!initialPw);
    setConfirmingDelete(true);
    requestAnimationFrame(() => {
      if (!initialPw) {
        deletePwInputRef.current?.focus();
      } else {
        deleteConfirmBtnRef.current?.focus();
      }
    });
  };

  const handleCancelDelete = () => {
    setConfirmingDelete(false);
    setDeleteError("");
    setForceShowDeletePw(false);
    requestAnimationFrame(() => {
      deleteTriggerRef.current?.focus();
    });
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setDeleteError("");
    const effectivePw = deletePassword || password;
    if (!effectivePw) {
      setForceShowDeletePw(true);
      setDeleteError("Podaj hasło profilu, aby potwierdzić usunięcie.");
      requestAnimationFrame(() => {
        deletePwInputRef.current?.focus();
      });
      return;
    }

    setIsDeleting(true);
    try {
      await apiSend(`/api/profiles/${editingId}`, "DELETE", { password: effectivePw });
      setConfirmingDelete(false);
      if (onProfileDeleted) {
        await onProfileDeleted(editingId);
      }
      reportStatus("Profil został usunięty.", false, "Usunięto ✓");
    } catch (err) {
      const msg = err.message || "Nie udało się usunąć profilu.";
      setForceShowDeletePw(true);
      setDeleteError(msg);
      requestAnimationFrame(() => {
        deletePwInputRef.current?.focus();
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      reportStatus("Podaj imię.", true, "Podaj imię", "name");
      focusTabField("skills", nameInputRef);
      return;
    }

    if (isFemaleName(cleanName)) {
      reportStatus(
        "Platforma Bronet jest wyłącznie dla facetów (men only). Dozwolone są tylko męskie profile.",
        true,
        "Men only",
        "name"
      );
      focusTabField("skills", nameInputRef);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      reportStatus("Podaj adres e-mail w zakładce Dane logowania.", true, "Podaj e-mail", "email");
      focusTabField("auth", emailInputRef);
      return;
    }

    if (!password) {
      reportStatus(
        editingId && hasPassword
          ? "Podaj hasło profilu w zakładce Dane logowania."
          : "Ustaw hasło w zakładce Dane logowania.",
        true,
        "Podaj hasło",
        "password"
      );
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
      location_name: locationName.trim(),
      lat,
      lng,
      share_location: shareLocation,
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
      setAutoCreateEmail("");
      setEditingId(saved.id);
      setHasPassword(Boolean(saved.has_password));
      if (wasCreating) {
        setActiveTab("skills");
      }

      await onProfileSaved(saved);

      reportStatus(`Zapisano profil „${saved.name}” ✓`, false, "Zapisano ✓");
    } catch (err) {
      const msg = err.message || "Nie udało się zapisać profilu.";
      const lower = msg.toLowerCase();
      if (lower.includes("hasł")) {
        reportStatus(msg, true, null, "password");
        focusTabField("auth", passwordInputRef);
      } else if (lower.includes("e-mail") || lower.includes("email")) {
        reportStatus(msg, true, null, "email");
        focusTabField("auth", emailInputRef);
      } else {
        reportStatus(msg, true);
      }
    } finally {
      setIsSubmitting(false);
      onSavingChange(false);
    }
  };

  return (
    <section id="view-editor" className="view view-animate" aria-labelledby="editor-heading">
      <div className="editor-header-row">
        <h1 className="page-title" id="editor-heading">
          {!isLoggedIn && !showLoginFront ? "Załóż profil" : "Profil"}
        </h1>
        {!isLoggedIn && !showLoginFront && (
          <button type="button" className="text-action" onClick={handleBackToLogin}>
            ← Logowanie
          </button>
        )}
      </div>

      {showLoginFront ? (
        <>
          <p className="login-intro">
            Zaloguj się na swój profil po adresie e-mail lub załóż nowy.
          </p>
          <form
            id="login-form"
            className="profile-sheet"
            aria-label="Formularz logowania do profilu"
            noValidate
            onSubmit={handleLoginFormSubmit}
          >
            <div className="sheet-line sheet-line-wrap">
              <label htmlFor="login-email" className="sheet-label">
                E-mail:
              </label>
              <div className="inline-entry-group">
                <input
                  ref={loginEmailRef}
                  type="email"
                  id="login-email"
                  name="email"
                  inputMode="email"
                  enterKeyHint={password ? "go" : "next"}
                  autoComplete="username email"
                  required
                  aria-invalid={invalidField === "email" ? "true" : undefined}
                  aria-describedby={feedback.message ? "login-feedback" : undefined}
                  className="inline-input"
                  placeholder="wpisz e-mail swojego profilu"
                  maxLength={160}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (invalidField === "email") setInvalidField("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email.trim().includes("@") && !password) {
                      e.preventDefault();
                      loginPasswordRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            <div className="sheet-line sheet-line-wrap">
              <label htmlFor="login-password" className="sheet-label">
                Hasło:
              </label>
              <div className="inline-entry-group">
                <input
                  ref={loginPasswordRef}
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  name="password"
                  enterKeyHint="go"
                  autoComplete="current-password"
                  required
                  aria-invalid={invalidField === "password" ? "true" : undefined}
                  aria-describedby={feedback.message ? "login-feedback" : undefined}
                  className="inline-input"
                  placeholder="wpisz hasło i naciśnij Enter"
                  maxLength={200}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (invalidField === "password") setInvalidField("");
                  }}
                />
                <button
                  type="button"
                  className="inline-add-btn"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Ukryj" : "Pokaż"}
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
                {isLoggingIn ? "Logowanie..." : "Zaloguj"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleStartCreate}>
                Załóż nowy profil →
              </button>
              <span
                id="login-feedback"
                className={`save-feedback ${feedback.isError ? "is-error" : ""}`}
                role={feedback.isError ? "alert" : "status"}
                aria-live={feedback.isError ? "assertive" : "polite"}
              >
                {feedback.message}
              </span>
            </div>
          </form>
        </>
      ) : (
        <>
          {!isLoggedIn && autoCreateEmail && (
            <div className="create-prompt-banner" role="status" aria-live="polite">
              Nie znaleziono profilu dla <strong>{autoCreateEmail}</strong> — załóż go teraz. Twój
              e-mail i hasło zostały już wpisane, uzupełnij imię oraz umiejętności poniżej.
            </div>
          )}

          <div className="profile-tabs" role="tablist" aria-label="Sekcje profilu">
            {EDITOR_TABS.map((tab, idx) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[tab.key] = el;
                  }}
                  id={`editor-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  aria-controls={`editor-panel-${tab.key}`}
                  className={`profile-tab ${isSelected ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form
            ref={formRef}
            id="profile-form"
            className="profile-sheet"
            noValidate
            onSubmit={handleSubmit}
          >
            {/* Zakładka 1 (frontowa dla profilu): Umiejętności */}
            <div
              id="editor-panel-skills"
              role="tabpanel"
              aria-labelledby="editor-tab-skills"
              className="profile-tab-panel"
              hidden={activeTab !== "skills"}
            >
              <div className="sheet-line">
                <label htmlFor="field-name" className="sheet-label">
                  Imię:
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  id="field-name"
                  name="name"
                  enterKeyHint="done"
                  required
                  aria-invalid={invalidField === "name" ? "true" : undefined}
                  aria-describedby={feedback.message ? "editor-feedback" : undefined}
                  className="inline-input"
                  placeholder="wpisz imię, np. Paweł"
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (invalidField === "name") setInvalidField("");
                  }}
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
                      onChange={(e) =>
                        handleSkillChange(e.target.value, setCanHelpInput, setCanHelpList)
                      }
                      onKeyDown={(e) => {
                        if (e.key === ",") {
                          e.preventDefault();
                          commitCanHelp();
                        } else if (e.key === "Enter" && canHelpInput.trim()) {
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
                        aria-label={`Dodaj do Umiem: ${s}`}
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
                        if (e.key === ",") {
                          e.preventDefault();
                          commitNeedHelp();
                        } else if (e.key === "Enter" && needHelpInput.trim()) {
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
                          onClick={() =>
                            setNeedHelpList((prev) => prev.filter((_, i) => i !== idx))
                          }
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
                        aria-label={`Dodaj do Potrzebuję: ${s}`}
                        onClick={() => setNeedHelpList((prev) => mergeUniqueSkills(prev, s))}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Zakładka 2: Lokalizacja */}
            <div
              id="editor-panel-location"
              role="tabpanel"
              aria-labelledby="editor-tab-location"
              className="profile-tab-panel"
              hidden={activeTab !== "location"}
            >
              <div className="sheet-line sheet-line-wrap">
                <label className="sheet-label" htmlFor="field-share-location">
                  Udostępnianie:
                </label>
                <div className="inline-entry-group">
                  <label
                    className="checkbox-label"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      id="field-share-location"
                      name="share_location"
                      checked={shareLocation}
                      onChange={(e) => setShareLocation(e.target.checked)}
                    />
                    <span>
                      Udostępnij moją lokalizację na <strong>Mapie Chłopów</strong>
                    </span>
                  </label>
                </div>
              </div>

              <div className="sheet-line sheet-line-wrap">
                <label htmlFor="field-location-name" className="sheet-label">
                  Miasto / Rejon:
                </label>
                <div
                  className="inline-entry-group"
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}
                >
                  <input
                    type="text"
                    id="field-location-name"
                    name="location_name"
                    className="inline-input"
                    placeholder="np. Warszawa, Kraków, Wrocław, Gdańsk..."
                    maxLength={100}
                    value={locationName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocationName(val);
                      const coords = findCityCoords(val);
                      if (coords) {
                        setLat(coords.lat);
                        setLng(coords.lng);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isGettingGps}
                    onClick={() => {
                      if (!navigator.geolocation) {
                        reportStatus("Twoja przeglądarka nie wspiera geolokalizacji GPS.", true);
                        return;
                      }
                      setIsGettingGps(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setIsGettingGps(false);
                          setLat(pos.coords.latitude);
                          setLng(pos.coords.longitude);
                          setShareLocation(true);
                          if (!locationName) {
                            setLocationName("Moja lokalizacja GPS");
                          }
                          reportStatus("Pobrano współrzędne GPS ✓", false, "Pobrano GPS");
                        },
                        () => {
                          setIsGettingGps(false);
                          reportStatus("Nie udało się pobrać lokalizacji z GPS.", true);
                        },
                        { timeout: 8000 }
                      );
                    }}
                  >
                    {isGettingGps ? "Pobieranie..." : "📍 Pobierz z GPS"}
                  </button>
                </div>
              </div>

              <div className="quick-suggestions-box">
                <span className="suggestions-label">Popularne miasta:</span>
                <div className="suggestions-chips">
                  {POPULAR_CITIES.slice(0, 10).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`skill-suggestion-chip ${
                        locationName.toLowerCase() === c.name.toLowerCase() ? "is-active" : ""
                      }`}
                      onClick={() => {
                        setLocationName(c.name);
                        setLat(c.lat);
                        setLng(c.lng);
                        setShareLocation(true);
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {lat != null && lng != null && (
                <div
                  className="location-coords-info"
                  style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 8 }}
                >
                  Współrzędne na mapie: {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
                </div>
              )}
            </div>

            {/* Zakładka 3: Kontakt */}
            <div
              id="editor-panel-contact"
              role="tabpanel"
              aria-labelledby="editor-tab-contact"
              className="profile-tab-panel"
              hidden={activeTab !== "contact"}
            >
              <div className="sheet-line">
                <label htmlFor="field-contact" className="sheet-label">
                  Kontakt <span className="label-sub">(opcjonalnie):</span>
                </label>
                <input
                  type="text"
                  id="field-contact"
                  name="contact"
                  enterKeyHint="done"
                  className="inline-input"
                  placeholder="np. telefon, komunikator, @nick lub dodatkowy namiar"
                  maxLength={160}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
            </div>

            {/* Zakładka 3: O mnie */}
            <div
              id="editor-panel-bio"
              role="tabpanel"
              aria-labelledby="editor-tab-bio"
              className="profile-tab-panel"
              hidden={activeTab !== "bio"}
            >
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
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                />
              </div>
            </div>

            {/* Zakładka 5: Statystyki i Chłopocoin (Ekonomia Blockchain) */}
            <div
              id="editor-panel-stats"
              role="tabpanel"
              aria-labelledby="editor-tab-stats"
              className="profile-tab-panel"
              hidden={activeTab !== "stats"}
            >
              <div className="stats-hero-card" id="stats-hero-coin-card">
                <div className="stats-hero-icon" aria-hidden="true">🪙</div>
                <div className="stats-hero-info">
                  <div className="stats-hero-label">Twoje saldo w sieci Chłopchain:</div>
                  <div className="stats-hero-balance">
                    <span id="stats-coin-balance" className="coin-balance-big">
                      {chlopocoinStats?.balance ?? (myProfile?.chlopocoin_balance || 0)}
                    </span>
                    <span className="coin-currency">Chłopocoinów (CC)</span>
                  </div>
                  <p className="stats-hero-sub">
                    Ekonomia Blockchain Bronet (Proof of Chłop Help). Autentyczny konsensus 2/2 — każdy coin powstaje z realnej, obustronnie potwierdzonej pomocy między chłopami.
                  </p>
                </div>
              </div>

              <div className="stats-metrics-grid">
                <div className="stat-metric-card">
                  <div className="metric-val" id="stats-metric-balance">
                    🪙 {chlopocoinStats?.balance ?? (myProfile?.chlopocoin_balance || 0)} CC
                  </div>
                  <div className="metric-desc">Saldo Chłopocoinów</div>
                </div>

                <div className="stat-metric-card">
                  <div className="metric-val" id="stats-metric-completed">
                    🤝 {chlopocoinStats?.completed_helps ?? 0}
                  </div>
                  <div className="metric-desc">Zatwierdzone wymiany (2/2)</div>
                </div>

                <div className="stat-metric-card">
                  <div className="metric-val" id="stats-metric-pending">
                    ⏳ {chlopocoinStats?.waiting_for_them_count ?? 0}
                  </div>
                  <div className="metric-desc">Czeka na potwierdzenie</div>
                </div>
              </div>

              <div className="stats-blockchain-ledger" id="stats-blocks-ledger">
                <h4 className="ledger-title">⛓️ Księga Rozproszona Chłopchain (Wykopane bloki)</h4>
                {loadingStats ? (
                  <p className="label-sub">Synchronizacja łańcucha bloków...</p>
                ) : chlopocoinStats?.blocks && chlopocoinStats.blocks.length > 0 ? (
                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Blok</th>
                          <th>Partner w pomocy</th>
                          <th>Hash bloku (SHA-256)</th>
                          <th>Data</th>
                          <th>Nagroda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chlopocoinStats.blocks.map((b) => (
                          <tr key={b.block_index}>
                            <td><strong>#{b.block_index}</strong></td>
                            <td>{b.partner_name}</td>
                            <td><code className="block-hash">{b.block_hash ? `${b.block_hash.slice(0, 16)}...` : ""}</code></td>
                            <td>{b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                            <td><span className="badge badge-success">+1 🪙 CC</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ledger-empty-box">
                    <p className="ledger-empty-title">
                      Brak wykopanych bloków w Twoim portfelu.
                    </p>
                    <p className="label-sub">
                      Gdy zmatchujesz się z innym chłopem i po udanej pomocy <strong>obaj klikniecie coina na swoich profilach</strong>, Chłopchain zatwierdzi blok i obaj otrzymacie po 1 Chłopocoinie!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Zakładka 6: Dane logowania */}
            <div
              id="editor-panel-auth"
              role="tabpanel"
              aria-labelledby="editor-tab-auth"
              className="profile-tab-panel"
              hidden={activeTab !== "auth"}
            >
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
                    enterKeyHint="done"
                    autoComplete="email"
                    required
                    aria-invalid={invalidField === "email" ? "true" : undefined}
                    aria-describedby={feedback.message ? "editor-feedback" : undefined}
                    className="inline-input"
                    placeholder="twój@email.pl"
                    maxLength={160}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (invalidField === "email") setInvalidField("");
                    }}
                  />
                </div>
              </div>

              <div className="sheet-line sheet-line-wrap">
                <label htmlFor="field-password" className="sheet-label">
                  {!isLoggedIn
                    ? "Hasło:"
                    : hasPassword
                    ? "Hasło profilu:"
                    : "Ustaw hasło:"}
                </label>
                <div className="inline-entry-group">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    id="field-password"
                    name="password"
                    enterKeyHint="done"
                    autoComplete={isLoggedIn && hasPassword ? "current-password" : "new-password"}
                    required
                    aria-invalid={invalidField === "password" ? "true" : undefined}
                    aria-describedby={feedback.message ? "editor-feedback" : undefined}
                    className="inline-input"
                    placeholder={
                      !isLoggedIn
                        ? "ustaw hasło do profilu"
                        : hasPassword
                        ? "podaj hasło profilu, aby zapisać zmiany"
                        : "ustaw wymagane hasło do profilu"
                    }
                    maxLength={200}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (invalidField === "password") setInvalidField("");
                    }}
                  />
                  <button
                    type="button"
                    className="inline-add-btn"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
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
                      enterKeyHint="done"
                      autoComplete="new-password"
                      className="inline-input"
                      placeholder="zostaw puste, jeśli nie zmieniasz hasła"
                      maxLength={200}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
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

            <div className="form-actions">
              {activeTab !== "stats" ? (
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || isDeleting}>
                  {editingId ? "Zapisz zmiany w profilu" : "Zapisz profil"}
                </button>
              ) : (
                <span className="stats-tab-readonly-hint">
                  🪙 Statystyki Chłopchain są aktualizowane automatycznie w czasie rzeczywistym.
                </span>
              )}
              <span
                id="editor-feedback"
                className={`save-feedback ${feedback.isError ? "is-error" : ""}`}
                role={feedback.isError ? "alert" : "status"}
                aria-live={feedback.isError ? "assertive" : "polite"}
              >
                {feedback.message}
              </span>
              {isLoggedIn && editingId && !confirmingDelete && (
                <button
                  ref={deleteTriggerRef}
                  type="button"
                  className="btn btn-danger-ghost form-actions-end"
                  onClick={handleOpenDeleteConfirm}
                >
                  Usuń profil
                </button>
              )}
            </div>
          </form>

          {isLoggedIn && editingId && confirmingDelete && (
            <form
              className="delete-confirm-box"
              aria-labelledby="delete-confirm-title"
              noValidate
              onSubmit={handleConfirmDelete}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelDelete();
                }
              }}
            >
              <p id="delete-confirm-title" className="delete-confirm-title">
                Na pewno trwale usunąć profil „{name.trim() || myProfile?.name || "ten profil"}”? Tej operacji nie można cofnąć.
              </p>

              {(forceShowDeletePw || !password) && (
                <div className="sheet-line sheet-line-wrap delete-pw-row">
                  <label htmlFor="delete-confirm-password" className="sheet-label">
                    Hasło profilu:
                  </label>
                  <div className="inline-entry-group">
                    <input
                      ref={deletePwInputRef}
                      type={showPassword ? "text" : "password"}
                      id="delete-confirm-password"
                      name="delete_password"
                      enterKeyHint="go"
                      autoComplete="current-password"
                      required
                      aria-invalid={deleteError ? "true" : undefined}
                      aria-describedby={deleteError ? "delete-confirm-error" : undefined}
                      className="inline-input"
                      placeholder="wpisz hasło profilu, aby potwierdzić"
                      maxLength={200}
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        if (deleteError) setDeleteError("");
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="delete-confirm-actions">
                <button
                  ref={deleteConfirmBtnRef}
                  type="submit"
                  className="btn btn-danger"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Usuwanie..." : "Tak, usuń profil"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={isDeleting}
                  onClick={handleCancelDelete}
                >
                  Anuluj
                </button>
                {deleteError && (
                  <span id="delete-confirm-error" className="save-feedback is-error" role="alert">
                    {deleteError}
                  </span>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
