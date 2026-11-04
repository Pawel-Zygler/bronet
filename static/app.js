(function () {
  "use strict";

  const STORAGE_KEY_MY_PROFILE = "bronet_my_profile_id";

  const PL_MAP = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
  };

  function normalizeText(str) {
    return String(str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[ąćęłńóśźż]/g, (ch) => PL_MAP[ch] || ch);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const state = {
    myProfileId: Number(localStorage.getItem(STORAGE_KEY_MY_PROFILE)) || null,
    myProfile: null,
    editingProfileId: null, // null = creating new profile
    editingHasPassword: false,
    sessionPasswords: {}, // in-memory only: { [profileId]: password }
    editorCanHelp: [],
    editorNeedHelp: [],
    searchQuery: "",
    searchMode: "all", // 'all' | 'can_help' | 'need_help'
    skillsCatalog: { all: [], can_help: [], need_help: [] },
    profiles: [],
  };

  // DOM Elements
  const views = {
    home: document.getElementById("view-home"),
    editor: document.getElementById("view-editor"),
    detail: document.getElementById("view-detail"),
  };

  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const popularSkillsBar = document.getElementById("popular-skills-bar");
  const searchResultsWrapEl = document.getElementById("search-results-wrap");
  const profilesListEl = document.getElementById("profiles-list");
  const resultsCountEl = document.getElementById("results-count");
  const activeFilterHintEl = document.getElementById("active-filter-hint");
  const navMyProfileLabel = document.getElementById("nav-my-profile-label");
  const mobileProfileLabel = document.getElementById("mobile-profile-label");

  // Editor Elements
  const editorHeading = document.getElementById("editor-heading");
  const profileForm = document.getElementById("profile-form");
  const fieldEmail = document.getElementById("field-email");
  const loadByEmailBtn = document.getElementById("load-by-email-btn");
  const labelPassword = document.getElementById("label-password");
  const fieldPassword = document.getElementById("field-password");
  const togglePasswordBtn = document.getElementById("toggle-password-btn");
  const newPasswordRow = document.getElementById("new-password-row");
  const fieldNewPassword = document.getElementById("field-new-password");
  const fieldName = document.getElementById("field-name");
  const fieldCanHelp = document.getElementById("field-can-help");
  const fieldNeedHelp = document.getElementById("field-need-help");
  const fieldContact = document.getElementById("field-contact");
  const fieldBio = document.getElementById("field-bio");
  const addCanHelpBtn = document.getElementById("add-can-help-btn");
  const addNeedHelpBtn = document.getElementById("add-need-help-btn");
  const tagsCanHelpEl = document.getElementById("tags-can-help");
  const tagsNeedHelpEl = document.getElementById("tags-need-help");
  const suggestionsCanHelpEl = document.getElementById("suggestions-can-help");
  const suggestionsNeedHelpEl = document.getElementById("suggestions-need-help");
  const saveFeedbackEl = document.getElementById("save-feedback");
  const saveProfileBtn = document.getElementById("save-profile-btn");
  const mobileEditorActionsEl = document.getElementById("mobile-editor-actions");
  const mobileSaveBtn = document.getElementById("mobile-save-btn");
  const mobileSaveHintEl = document.getElementById("mobile-save-hint");

  // Detail Elements
  const detailCardEl = document.getElementById("detail-card");
  const detailActionsEl = document.getElementById("detail-actions");

  // API Helpers
  async function apiGet(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Błąd HTTP ${res.status}`);
    }
    return res.json();
  }

  async function apiSend(url, method, body, extraHeaders = {}) {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Błąd zapisu (${res.status})`);
    }
    return res.json();
  }

  function setMyProfile(profile) {
    if (profile && profile.id) {
      state.myProfileId = profile.id;
      state.myProfile = profile;
      localStorage.setItem(STORAGE_KEY_MY_PROFILE, String(profile.id));
    } else {
      state.myProfileId = null;
      state.myProfile = null;
      localStorage.removeItem(STORAGE_KEY_MY_PROFILE);
    }
    syncHeaderProfileLabels();
  }

  function syncHeaderProfileLabels() {
    if (state.myProfile) {
      navMyProfileLabel.textContent = `Profil (${state.myProfile.name})`;
      mobileProfileLabel.textContent = state.myProfile.name;
    } else {
      navMyProfileLabel.textContent = "Profil";
      mobileProfileLabel.textContent = "Profil";
    }
  }

  async function loadInitialContext() {
    try {
      state.skillsCatalog = await apiGet("/api/skills");
    } catch (_) {
      state.skillsCatalog = { all: [], can_help: [], need_help: [] };
    }

    if (state.myProfileId) {
      try {
        const p = await apiGet(`/api/profiles/${state.myProfileId}`);
        setMyProfile(p);
      } catch (_) {
        setMyProfile(null);
      }
    } else {
      syncHeaderProfileLabels();
    }
  }

  // Navigation / Router
  function navigate(path, options = {}) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    routeCurrentPath(options);
  }

  let mobileHintTimer = null;
  function setSaveStatus(message, isError = false) {
    saveFeedbackEl.textContent = message;
    saveFeedbackEl.classList.toggle("is-error", Boolean(isError));

    if (mobileSaveHintEl) {
      clearTimeout(mobileHintTimer);
      if (!message) {
        mobileSaveHintEl.textContent = "";
        mobileSaveHintEl.classList.remove("is-error");
      } else {
        mobileSaveHintEl.textContent = isError ? message : "Zapisano ✓";
        mobileSaveHintEl.classList.toggle("is-error", Boolean(isError));
        if (!isError) {
          mobileHintTimer = setTimeout(() => {
            mobileSaveHintEl.textContent = "";
          }, 3000);
        }
      }
    }
  }

  function showOnlyView(activeKey, navKey) {
    Object.keys(views).forEach((k) => {
      views[k].hidden = k !== activeKey;
    });
    if (mobileEditorActionsEl) {
      mobileEditorActionsEl.hidden = activeKey !== "editor";
    }
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-nav") === navKey);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function routeCurrentPath(options = {}) {
    const path = window.location.pathname;
    if (path === "/profil") {
      showOnlyView("editor", "profile");
      if (options.forceFresh) {
        initEditorWithProfile(null);
      } else if (options.editProfile) {
        initEditorWithProfile(options.editProfile);
      } else if (state.myProfile) {
        // Refresh latest version of my profile
        try {
          const fresh = await apiGet(`/api/profiles/${state.myProfile.id}`);
          setMyProfile(fresh);
          initEditorWithProfile(fresh);
        } catch (_) {
          initEditorWithProfile(null);
        }
      } else {
        initEditorWithProfile(null);
      }
      return;
    }

    const detailMatch = path.match(/^\/profil\/(\d+)$/);
    if (detailMatch) {
      showOnlyView("detail", "");
      const pid = Number(detailMatch[1]);
      await renderProfileDetail(pid);
      return;
    }

    // Default: Landing Page + Search
    showOnlyView("home", "home");
    await refreshLandingPage();
  }

  // Landing Page & Search
  async function refreshLandingPage() {
    const trimmedQuery = state.searchQuery.trim();
    try {
      const catalog = await apiGet("/api/skills");
      state.skillsCatalog = catalog;
      renderPopularSkills();

      if (!trimmedQuery) {
        state.profiles = [];
        searchResultsWrapEl.hidden = true;
        profilesListEl.innerHTML = "";
        return;
      }

      const profiles = await apiGet(
        `/api/profiles?q=${encodeURIComponent(trimmedQuery)}&mode=${encodeURIComponent(
          state.searchMode
        )}`
      );
      state.profiles = profiles;
      searchResultsWrapEl.hidden = false;
      renderProfilesList();
    } catch (err) {
      if (trimmedQuery) {
        searchResultsWrapEl.hidden = false;
        profilesListEl.innerHTML = `<div class="empty-state">Nie udało się pobrać profili: ${escapeHtml(
          err.message
        )}</div>`;
      }
    }
  }

  function renderPopularSkills() {
    const sourceList =
      state.searchMode === "can_help"
        ? state.skillsCatalog.can_help
        : state.searchMode === "need_help"
        ? state.skillsCatalog.need_help
        : state.skillsCatalog.all;

    if (!sourceList || sourceList.length === 0) {
      popularSkillsBar.innerHTML = "";
      return;
    }

    const activeNorm = normalizeText(state.searchQuery);
    const chipsHtml = sourceList
      .slice(0, 12)
      .map((item) => {
        const isSelected = activeNorm && activeNorm === normalizeText(item.skill);
        return `<button type="button" class="skill-filter-chip ${
          isSelected ? "is-selected" : ""
        }" data-skill-filter="${escapeHtml(item.skill)}">${escapeHtml(item.skill)}</button>`;
      })
      .join("");

    popularSkillsBar.innerHTML = `<span class="popular-label">Popularne:</span>${chipsHtml}`;
  }

  function computeOverlapSet(listA) {
    const s = new Set();
    (listA || []).forEach((item) => {
      const n = normalizeText(item);
      if (n) s.add(n);
    });
    return s;
  }

  function renderProfileCardHtml(profile, context = {}) {
    const isSelf = state.myProfile && profile.id === state.myProfile.id;
    const myNeeds = computeOverlapSet(state.myProfile ? state.myProfile.need_help : []);
    const mySkills = computeOverlapSet(state.myProfile ? state.myProfile.can_help : []);
    const queryTerms = state.searchQuery
      .split(",")
      .map((t) => normalizeText(t))
      .filter(Boolean);

    let helpsMeCount = 0;
    let iHelpCount = 0;

    if (!isSelf && state.myProfile) {
      profile.can_help.forEach((s) => {
        if (myNeeds.has(normalizeText(s))) helpsMeCount++;
      });
      profile.need_help.forEach((s) => {
        if (mySkills.has(normalizeText(s))) iHelpCount++;
      });
    }

    let badgeHtml = "";
    if (isSelf) {
      badgeHtml = `<span class="badge badge-self">Twój profil</span>`;
    } else if (helpsMeCount > 0 && iHelpCount > 0) {
      badgeHtml = `<span class="badge badge-mutual">Wzajemna pomoc 1:1</span>`;
    } else if (helpsMeCount > 0) {
      badgeHtml = `<span class="badge badge-helps-me">Może Ci pomóc</span>`;
    } else if (iHelpCount > 0) {
      badgeHtml = `<span class="badge badge-i-help">Możesz pomóc</span>`;
    }

    const canHelpTags =
      profile.can_help.length > 0
        ? profile.can_help
            .map((skill) => {
              const sNorm = normalizeText(skill);
              const matchesQuery =
                context.highlightQuery &&
                state.searchMode !== "need_help" &&
                queryTerms.some((qt) => sNorm.includes(qt));
              const matchesNeed = !isSelf && myNeeds.has(sNorm);
              const hlClass = matchesQuery || matchesNeed ? "is-highlighted" : "";
              return `<button type="button" class="skill-tag ${hlClass}" data-card-skill="${escapeHtml(
                skill
              )}" data-card-mode="can_help" title="Szukaj osób, które umieją: ${escapeHtml(
                skill
              )}">${escapeHtml(skill)}</button>`;
            })
            .join("")
        : `<span class="label-sub">brak wpisanych</span>`;

    const needHelpTags =
      profile.need_help.length > 0
        ? profile.need_help
            .map((skill) => {
              const sNorm = normalizeText(skill);
              const matchesQuery =
                context.highlightQuery &&
                state.searchMode !== "can_help" &&
                queryTerms.some((qt) => sNorm.includes(qt));
              const matchesSkill = !isSelf && mySkills.has(sNorm);
              const hlClass = matchesQuery || matchesSkill ? "is-need-highlighted" : "";
              return `<button type="button" class="skill-tag ${hlClass}" data-card-skill="${escapeHtml(
                skill
              )}" data-card-mode="need_help" title="Szukaj osób potrzebujących: ${escapeHtml(
                skill
              )}">${escapeHtml(skill)}</button>`;
            })
            .join("")
        : `<span class="label-sub">brak wpisanych</span>`;

    const bioHtml = profile.bio
      ? `<p class="card-bio">${escapeHtml(profile.bio)}</p>`
      : "";

    return `
      <article class="profile-card">
        <div class="card-top">
          <div class="card-name-group">
            <a href="/profil/${profile.id}" class="card-name" data-link>${escapeHtml(profile.name)}</a>
            ${badgeHtml}
          </div>
          <a href="/profil/${profile.id}" class="card-open-link" data-link>Zobacz profil →</a>
        </div>
        ${bioHtml}
        <div class="card-row">
          <span class="card-row-label"><strong>Umiem</strong> (potrafię pomóc z):</span>
          ${canHelpTags}
        </div>
        <div class="card-row">
          <span class="card-row-label"><strong>Potrzebuję</strong> (szukam pomocy z):</span>
          ${needHelpTags}
        </div>
      </article>
    `;
  }

  function renderProfilesList() {
    const trimmed = state.searchQuery.trim();
    if (!trimmed) {
      searchResultsWrapEl.hidden = true;
      profilesListEl.innerHTML = "";
      return;
    }

    searchResultsWrapEl.hidden = false;
    const count = state.profiles.length;
    const modeLabel =
      state.searchMode === "can_help"
        ? "w sekcji „Umiem”"
        : state.searchMode === "need_help"
        ? "w sekcji „Potrzebuję”"
        : "";

    resultsCountEl.textContent = `Znalezione profile: ${count}`;
    activeFilterHintEl.textContent = modeLabel
      ? `Szukasz „${trimmed}” ${modeLabel}`
      : `Filtr: „${trimmed}”`;

    if (count === 0) {
      profilesListEl.innerHTML = `
        <div class="empty-state">
          Brak profili pasujących do wyszukiwania „${escapeHtml(trimmed)}”.
          <br />
          <button type="button" class="text-action" id="reset-empty-search" style="margin-top:8px;">Wyczyść wyszukiwanie</button>
        </div>
      `;
      const resetBtn = document.getElementById("reset-empty-search");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          setSearch("", "all");
        });
      }
      return;
    }

    profilesListEl.innerHTML = state.profiles
      .map((p) => renderProfileCardHtml(p, { highlightQuery: true }))
      .join("");
  }

  function setSearch(query, mode) {
    state.searchQuery = query;
    if (mode) {
      state.searchMode = mode;
      document.querySelectorAll(".filter-pill").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-mode") === state.searchMode);
      });
    }
    searchInput.value = state.searchQuery;
    searchClear.hidden = !state.searchQuery;
    refreshLandingPage();
  }

  // Editor Logic (Umiem / Potrzebuję)
  function addSkillsToEditorList(targetArray, rawValue) {
    if (!rawValue) return false;
    const parts = String(rawValue)
      .split(",")
      .map((s) => s.trim().replace(/\.+$/, "").trim())
      .filter(Boolean);

    let changed = false;
    const existingNorms = new Set(targetArray.map((item) => normalizeText(item)));
    parts.forEach((part) => {
      const n = normalizeText(part);
      if (n && !existingNorms.has(n)) {
        existingNorms.add(n);
        targetArray.push(part);
        changed = true;
      }
    });
    return changed;
  }

  function renderEditorTags() {
    tagsCanHelpEl.innerHTML = state.editorCanHelp
      .map(
        (skill, idx) => `
        <span class="editable-chip">
          ${escapeHtml(skill)}
          <button type="button" class="chip-remove" data-remove-can="${idx}" aria-label="Usuń ${escapeHtml(
          skill
        )}">×</button>
        </span>`
      )
      .join("");

    tagsNeedHelpEl.innerHTML = state.editorNeedHelp
      .map(
        (skill, idx) => `
        <span class="editable-chip">
          ${escapeHtml(skill)}
          <button type="button" class="chip-remove" data-remove-need="${idx}" aria-label="Usuń ${escapeHtml(
          skill
        )}">×</button>
        </span>`
      )
      .join("");

    renderEditorSuggestions();
  }

  function renderEditorSuggestions() {
    const defaultCan = ["qa", "it", "związki", "relacje męsko-damskie", "ux/ui", "finanse"];
    const defaultNeed = ["finanse", "sdlc", "realizacja pomysłów", "it", "podatki b2b", "angielski"];

    const dbCan = (state.skillsCatalog.all || []).map((x) => x.skill);
    const canCandidates = Array.from(new Set([...defaultCan, ...dbCan]));
    const needCandidates = Array.from(new Set([...defaultNeed, ...dbCan]));

    const chosenCanNorms = new Set(state.editorCanHelp.map(normalizeText));
    const chosenNeedNorms = new Set(state.editorNeedHelp.map(normalizeText));

    const availableCan = canCandidates.filter((s) => !chosenCanNorms.has(normalizeText(s))).slice(0, 7);
    const availableNeed = needCandidates.filter((s) => !chosenNeedNorms.has(normalizeText(s))).slice(0, 7);

    suggestionsCanHelpEl.innerHTML = availableCan.length
      ? `<span class="suggestion-hint">Szybki wybór:</span>` +
        availableCan
          .map(
            (s) =>
              `<button type="button" class="suggestion-btn" data-suggest-can="${escapeHtml(
                s
              )}">+ ${escapeHtml(s)}</button>`
          )
          .join("")
      : "";

    suggestionsNeedHelpEl.innerHTML = availableNeed.length
      ? `<span class="suggestion-hint">Szybki wybór:</span>` +
        availableNeed
          .map(
            (s) =>
              `<button type="button" class="suggestion-btn" data-suggest-need="${escapeHtml(
                s
              )}">+ ${escapeHtml(s)}</button>`
          )
          .join("")
      : "";
  }

  function syncPasswordFieldsForProfile(profile) {
    fieldNewPassword.value = "";
    if (!profile) {
      state.editingHasPassword = false;
      labelPassword.innerHTML = `Hasło <span class="label-sub">(opcjonalnie):</span>`;
      fieldPassword.placeholder = "dowolne hasło bez specjalnych wymagań";
      fieldPassword.value = "";
      newPasswordRow.hidden = true;
      return;
    }

    state.editingHasPassword = Boolean(profile.has_password);
    if (profile.has_password) {
      labelPassword.innerHTML = `Hasło profilu:`;
      fieldPassword.placeholder = "podaj hasło profilu, aby zapisać zmiany";
      fieldPassword.value = state.sessionPasswords[profile.id] || "";
      newPasswordRow.hidden = false;
    } else {
      labelPassword.innerHTML = `Dodaj hasło <span class="label-sub">(opcjonalnie):</span>`;
      fieldPassword.placeholder = "wpisz dowolne hasło, aby zabezpieczyć profil";
      fieldPassword.value = "";
      newPasswordRow.hidden = true;
    }
  }

  function initEditorWithProfile(profile) {
    setSaveStatus("", false);
    fieldCanHelp.value = "";
    fieldNeedHelp.value = "";

    if (profile) {
      state.editingProfileId = profile.id;
      editorHeading.textContent = "Profil";
      fieldEmail.value = profile.email || "";
      fieldName.value = profile.name || "";
      fieldContact.value = profile.contact || "";
      fieldBio.value = profile.bio || "";
      state.editorCanHelp = [...(profile.can_help || [])];
      state.editorNeedHelp = [...(profile.need_help || [])];
      saveProfileBtn.textContent = "Zapisz zmiany w profilu";
      syncPasswordFieldsForProfile(profile);
      renderEditorTags();
    } else {
      state.editingProfileId = null;
      editorHeading.textContent = "Profil";
      fieldEmail.value = "";
      fieldName.value = "";
      fieldContact.value = "";
      fieldBio.value = "";
      state.editorCanHelp = [];
      state.editorNeedHelp = [];
      saveProfileBtn.textContent = "Zapisz profil";
      syncPasswordFieldsForProfile(null);
      renderEditorTags();
    }
  }

  // Detail View (/profil/:id)
  async function renderProfileDetail(profileId) {
    detailCardEl.innerHTML = `<p class="label-sub">Ładowanie profilu...</p>`;
    detailActionsEl.innerHTML = "";

    try {
      const profile = await apiGet(`/api/profiles/${profileId}`);
      const isMine = state.myProfile && state.myProfile.id === profile.id;

      detailActionsEl.innerHTML = `
        <button type="button" class="btn btn-ghost" id="btn-edit-this-profile">Edytuj profil</button>
        ${
          !isMine
            ? `<button type="button" class="text-action" id="btn-set-as-mine" title="Ustaw jako mój aktywny profil w tej przeglądarce">Ustaw jako mój profil</button>`
            : `<span class="badge badge-self">Twój aktywny profil</span>`
        }
        <button type="button" class="text-action text-action-danger" id="btn-delete-this-profile">Usuń</button>
      `;

      const canTags = profile.can_help.length
        ? profile.can_help
            .map(
              (s) =>
                `<button type="button" class="skill-tag" data-detail-skill="${escapeHtml(
                  s
                )}" data-detail-mode="can_help">${escapeHtml(s)}</button>`
            )
            .join("")
        : `<span class="label-sub">brak wpisanych opcji</span>`;

      const needTags = profile.need_help.length
        ? profile.need_help
            .map(
              (s) =>
                `<button type="button" class="skill-tag" data-detail-skill="${escapeHtml(
                  s
                )}" data-detail-mode="need_help">${escapeHtml(s)}</button>`
            )
            .join("")
        : `<span class="label-sub">brak wpisanych opcji</span>`;

      detailCardEl.innerHTML = `
        <h1 class="page-title" style="margin-bottom: 20px;">Profil</h1>
        <div class="detail-line"><strong>Imię:</strong> ${escapeHtml(profile.name)}</div>
        ${
          profile.bio
            ? `<div class="detail-line"><strong>O mnie:</strong> ${escapeHtml(profile.bio)}</div>`
            : ""
        }
        <div class="detail-line">
          <strong>Umiem</strong> <span class="label-sub">(Potrafię pomóc z):</span>
          <div style="margin-top: 6px;">${canTags}</div>
        </div>
        <div class="detail-line">
          <strong>Potrzebuję</strong> <span class="label-sub">(Szukam pomocy z):</span>
          <div style="margin-top: 6px;">${needTags}</div>
        </div>
        ${
          profile.email
            ? `<div class="detail-contact-box"><strong>E-mail:</strong> <a href="mailto:${escapeHtml(
                profile.email
              )}" style="text-decoration: underline;">${escapeHtml(profile.email)}</a>${
                profile.contact && profile.contact !== profile.email
                  ? `<div style="margin-top: 6px;"><strong>Kontakt:</strong> ${escapeHtml(
                      profile.contact
                    )}</div>`
                  : ""
              }</div>`
            : profile.contact
            ? `<div class="detail-contact-box"><strong>Kontakt:</strong> ${escapeHtml(
                profile.contact
              )}</div>`
            : ""
        }
      `;

      document.getElementById("btn-edit-this-profile").addEventListener("click", () => {
        navigate("/profil", { editProfile: profile });
      });

      const setMineBtn = document.getElementById("btn-set-as-mine");
      if (setMineBtn) {
        setMineBtn.addEventListener("click", () => {
          setMyProfile(profile);
          renderProfileDetail(profile.id);
        });
      }

      document.getElementById("btn-delete-this-profile").addEventListener("click", async () => {
        let pwd = state.sessionPasswords[profile.id] || "";
        if (profile.has_password && !pwd) {
          const entered = window.prompt(`Profil „${profile.name}” jest chroniony hasłem. Podaj hasło, aby go usunąć:`);
          if (entered === null) return;
          pwd = entered;
        } else if (!window.confirm(`Czy na pewno usunąć profil „${profile.name}”?`)) {
          return;
        }

        try {
          await apiSend(
            `/api/profiles/${profile.id}`,
            "DELETE",
            null,
            pwd ? { "X-Profile-Password": pwd } : {}
          );
          delete state.sessionPasswords[profile.id];
          if (state.myProfile && state.myProfile.id === profile.id) {
            setMyProfile(null);
          }
          navigate("/");
        } catch (err) {
          window.alert(err.message || "Nie udało się usunąć profilu.");
        }
      });
    } catch (err) {
      detailCardEl.innerHTML = `<div class="empty-state">Nie znaleziono profilu (${escapeHtml(
        err.message
      )}).</div>`;
    }
  }

  // Event Listeners
  function bindEvents() {
    // Global SPA link interception
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-link]");
      if (link && link.getAttribute("href")) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(link.getAttribute("href"));
        return;
      }

      // Popular filter chip click
      const filterChip = e.target.closest("[data-skill-filter]");
      if (filterChip) {
        const skill = filterChip.getAttribute("data-skill-filter");
        if (normalizeText(state.searchQuery) === normalizeText(skill)) {
          setSearch("", state.searchMode);
        } else {
          setSearch(skill, state.searchMode);
        }
        return;
      }

      // Profile card skill tag click -> filter landing page by that skill
      const cardSkill = e.target.closest("[data-card-skill]");
      if (cardSkill) {
        const skill = cardSkill.getAttribute("data-card-skill");
        const mode = cardSkill.getAttribute("data-card-mode") || "all";
        setSearch(skill, mode);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Detail skill tag click -> jump to landing search
      const detailSkill = e.target.closest("[data-detail-skill]");
      if (detailSkill) {
        const skill = detailSkill.getAttribute("data-detail-skill");
        const mode = detailSkill.getAttribute("data-detail-mode") || "all";
        state.searchQuery = skill;
        state.searchMode = mode;
        searchInput.value = skill;
        searchClear.hidden = !skill;
        document.querySelectorAll(".filter-pill").forEach((btn) => {
          btn.classList.toggle("is-active", btn.getAttribute("data-mode") === mode);
        });
        navigate("/");
        return;
      }

      // Editor chip removals
      const remCan = e.target.closest("[data-remove-can]");
      if (remCan) {
        const idx = Number(remCan.getAttribute("data-remove-can"));
        state.editorCanHelp.splice(idx, 1);
        renderEditorTags();
        return;
      }

      const remNeed = e.target.closest("[data-remove-need]");
      if (remNeed) {
        const idx = Number(remNeed.getAttribute("data-remove-need"));
        state.editorNeedHelp.splice(idx, 1);
        renderEditorTags();
        return;
      }

      // Editor quick suggestions
      const sugCan = e.target.closest("[data-suggest-can]");
      if (sugCan) {
        addSkillsToEditorList(state.editorCanHelp, sugCan.getAttribute("data-suggest-can"));
        renderEditorTags();
        return;
      }

      const sugNeed = e.target.closest("[data-suggest-need]");
      if (sugNeed) {
        addSkillsToEditorList(state.editorNeedHelp, sugNeed.getAttribute("data-suggest-need"));
        renderEditorTags();
        return;
      }
    });

    window.addEventListener("popstate", () => {
      routeCurrentPath();
    });

    // Search input with debounce
    let searchTimer = null;
    searchInput.addEventListener("input", () => {
      state.searchQuery = searchInput.value;
      searchClear.hidden = !state.searchQuery;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        refreshLandingPage();
      }, 150);
    });

    searchClear.addEventListener("click", () => {
      setSearch("", state.searchMode);
      searchInput.focus();
    });

    document.querySelectorAll(".filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const mode = pill.getAttribute("data-mode");
        setSearch(state.searchQuery, mode);
      });
    });

    // Inline skill entry handlers (Enter or comma)
    function wireSkillInput(inputEl, btnEl, targetList) {
      const commitInput = () => {
        if (inputEl.value.trim()) {
          addSkillsToEditorList(targetList, inputEl.value);
          inputEl.value = "";
          renderEditorTags();
        }
      };

      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commitInput();
        }
      });

      inputEl.addEventListener("input", () => {
        if (inputEl.value.includes(",")) {
          const parts = inputEl.value.split(",");
          const trailing = parts.pop() || "";
          addSkillsToEditorList(targetList, parts.join(","));
          inputEl.value = trailing.trimStart();
          renderEditorTags();
        }
      });

      btnEl.addEventListener("click", () => {
        commitInput();
        inputEl.focus();
      });
    }

    wireSkillInput(fieldCanHelp, addCanHelpBtn, state.editorCanHelp);
    wireSkillInput(fieldNeedHelp, addNeedHelpBtn, state.editorNeedHelp);

    togglePasswordBtn.addEventListener("click", () => {
      const nextType = fieldPassword.type === "password" ? "text" : "password";
      fieldPassword.type = nextType;
      fieldNewPassword.type = nextType;
      togglePasswordBtn.textContent = nextType === "password" ? "Pokaż" : "Ukryj";
    });

    loadByEmailBtn.addEventListener("click", async () => {
      const email = fieldEmail.value.trim().toLowerCase();
      const password = fieldPassword.value;
      setSaveStatus("", false);
      if (!email || !email.includes("@")) {
        setSaveStatus("Wpisz poprawny e-mail.", true);
        fieldEmail.focus();
        return;
      }
      try {
        const found = await apiSend("/api/profiles/login", "POST", { email, password });
        if (found.has_password && password) {
          state.sessionPasswords[found.id] = password;
        }
        setMyProfile(found);
        initEditorWithProfile(found);
        setSaveStatus(`Wczytano profil „${found.name}” ✓`, false);
      } catch (err) {
        setSaveStatus(err.message || "Nie udało się wczytać profilu.", true);
        if ((err.message || "").toLowerCase().includes("hasł")) {
          fieldPassword.focus();
        }
      }
    });

    // Form submit — real persistence to SQLite via REST API
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setSaveStatus("", false);

      // Harvest any uncommitted text left in inputs
      if (fieldCanHelp.value.trim()) {
        addSkillsToEditorList(state.editorCanHelp, fieldCanHelp.value);
        fieldCanHelp.value = "";
      }
      if (fieldNeedHelp.value.trim()) {
        addSkillsToEditorList(state.editorNeedHelp, fieldNeedHelp.value);
        fieldNeedHelp.value = "";
      }
      renderEditorTags();

      const email = fieldEmail.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setSaveStatus("Podaj adres e-mail.", true);
        fieldEmail.focus();
        return;
      }

      const name = fieldName.value.trim();
      if (!name) {
        setSaveStatus("Podaj imię.", true);
        fieldName.focus();
        return;
      }

      const password = fieldPassword.value;
      const newPassword = fieldNewPassword.value;

      if (state.editingProfileId && state.editingHasPassword && !password) {
        setSaveStatus("Podaj hasło profilu.", true);
        fieldPassword.focus();
        return;
      }

      const payload = {
        name,
        email,
        password,
        new_password: newPassword,
        can_help: state.editorCanHelp,
        need_help: state.editorNeedHelp,
        contact: fieldContact.value.trim(),
        bio: fieldBio.value.trim(),
      };

      saveProfileBtn.disabled = true;
      if (mobileSaveBtn) mobileSaveBtn.disabled = true;
      try {
        let saved;
        if (state.editingProfileId) {
          saved = await apiSend(`/api/profiles/${state.editingProfileId}`, "PUT", payload);
        } else {
          saved = await apiSend("/api/profiles", "POST", payload);
        }

        const effectivePw = newPassword || password;
        if (saved.has_password && effectivePw) {
          state.sessionPasswords[saved.id] = effectivePw;
        }

        setMyProfile(saved);
        state.editingProfileId = saved.id;
        state.skillsCatalog = await apiGet("/api/skills");
        saveProfileBtn.textContent = "Zapisz zmiany w profilu";
        syncPasswordFieldsForProfile(saved);
        renderEditorTags();
        setSaveStatus(
          saved.has_password
            ? `Zapisano profil „${saved.name}” (chroniony hasłem) ✓`
            : `Zapisano profil „${saved.name}” ✓`,
          false
        );
      } catch (err) {
        setSaveStatus(err.message || "Nie udało się zapisać profilu.", true);
        if ((err.message || "").toLowerCase().includes("hasł")) {
          fieldPassword.focus();
        }
      } finally {
        saveProfileBtn.disabled = false;
        if (mobileSaveBtn) mobileSaveBtn.disabled = false;
      }
    });
  }

  // Boot
  (async function boot() {
    bindEvents();
    await loadInitialContext();
    await routeCurrentPath();
  })();
})();

