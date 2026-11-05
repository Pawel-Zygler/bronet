import React, { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api";
import { MobileNav } from "./components/MobileNav";
import { Topbar } from "./components/Topbar";
import { HomeView } from "./views/HomeView";
import { ProfileDetailView } from "./views/ProfileDetailView";
import { ProfileEditorView } from "./views/ProfileEditorView";

const STORAGE_KEY_MY_PROFILE = "bronet_my_profile_id";
const STORAGE_KEY_MY_PROFILE_CACHE = "bronet_my_profile_cache";

function loadStoredProfile() {
  try {
    const savedId = Number(localStorage.getItem(STORAGE_KEY_MY_PROFILE)) || null;
    if (!savedId) return null;
    const raw = localStorage.getItem(STORAGE_KEY_MY_PROFILE_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.id === savedId ? parsed : null;
  } catch (_) {
    return null;
  }
}

function parseRoute(pathname) {
  if (pathname === "/profil") {
    return { view: "editor", nav: "profile", profileId: null };
  }
  const match = pathname.match(/^\/profil\/(\d+)$/);
  if (match) {
    return { view: "detail", nav: "", profileId: Number(match[1]) };
  }
  return { view: "home", nav: "home", profileId: null };
}

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const route = parseRoute(pathname);

  const [myProfile, setMyProfileState] = useState(() => loadStoredProfile());
  const [profileSyncVersion, setProfileSyncVersion] = useState(0);
  const [editorInitialTab, setEditorInitialTab] = useState(() =>
    loadStoredProfile() ? "skills" : "auth"
  );
  const [sessionPasswords, setSessionPasswords] = useState({});

  const [skillsCatalog, setSkillsCatalog] = useState({
    all: [],
    can_help: [],
    need_help: [],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("all");
  const [profiles, setProfiles] = useState([]);
  const [profilesCache, setProfilesCache] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRefreshTick, setSearchRefreshTick] = useState(0);

  // Mobile sticky save bar state
  const [showMobileSave, setShowMobileSave] = useState(Boolean(myProfile));
  const [isSaving, setIsSaving] = useState(false);
  const [mobileHint, setMobileHint] = useState("");
  const [mobileHintError, setMobileHintError] = useState(false);
  const mobileHintTimerRef = useRef(null);

  const myProfileRef = useRef(myProfile);
  myProfileRef.current = myProfile;

  const setMyProfile = useCallback((profile, syncEditor = true) => {
    if (profile && profile.id) {
      localStorage.setItem(STORAGE_KEY_MY_PROFILE, String(profile.id));
      try {
        localStorage.setItem(STORAGE_KEY_MY_PROFILE_CACHE, JSON.stringify(profile));
      } catch (_) {
        // ignore quota errors
      }
      setMyProfileState(profile);
      setProfilesCache((prev) => ({ ...prev, [profile.id]: profile }));
    } else {
      localStorage.removeItem(STORAGE_KEY_MY_PROFILE);
      localStorage.removeItem(STORAGE_KEY_MY_PROFILE_CACHE);
      setMyProfileState(null);
    }
    if (syncEditor) {
      setProfileSyncVersion((v) => v + 1);
    }
  }, []);

  const handleStatusChange = useCallback((message, isError = false, mobileShort = null) => {
    clearTimeout(mobileHintTimerRef.current);
    if (!message) {
      setMobileHint("");
      setMobileHintError(false);
      return;
    }
    setMobileHint(mobileShort || (isError ? message : "Zapisano ✓"));
    setMobileHintError(Boolean(isError));
    if (!isError) {
      mobileHintTimerRef.current = setTimeout(() => {
        setMobileHint("");
      }, 3000);
    }
  }, []);

  const navigate = useCallback((nextPath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    if (nextPath === "/profil") {
      setEditorInitialTab(myProfileRef.current ? "skills" : "auth");
      setMobileHint("");
      setMobileHintError(false);
    }
    startTransition(() => {
      setPathname(nextPath);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname;
      if (next === "/profil") {
        setEditorInitialTab(myProfileRef.current ? "skills" : "auth");
      }
      startTransition(() => {
        setPathname(next);
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Initial boot: fetch skills catalog + active profile in parallel
  useEffect(() => {
    const savedId = Number(localStorage.getItem(STORAGE_KEY_MY_PROFILE)) || null;

    apiGet("/api/skills")
      .then((cat) => setSkillsCatalog(cat))
      .catch(() => {});

    if (savedId) {
      apiGet(`/api/profiles/${savedId}`)
        .then((p) => {
          setEditorInitialTab("skills");
          setMyProfile(p, true);
        })
        .catch(() => {
          setEditorInitialTab("auth");
          setMyProfile(null, true);
        });
    }
  }, [setMyProfile]);

  // Reactive debounced search with AbortController (cancels stale requests)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setProfiles([]);
      setIsSearching(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError("");

    const timer = setTimeout(() => {
      apiGet(
        `/api/profiles?q=${encodeURIComponent(trimmed)}&mode=${encodeURIComponent(searchMode)}`,
        controller.signal
      )
        .then((list) => {
          setProfiles(list);
          setProfilesCache((prev) => {
            const next = { ...prev };
            list.forEach((p) => {
              next[p.id] = p;
            });
            return next;
          });
          setIsSearching(false);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setSearchError(err.message || "Błąd wyszukiwania");
          setIsSearching(false);
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, searchMode, searchRefreshTick]);

  const handleSearchChange = useCallback((nextQuery, nextMode) => {
    setSearchQuery(nextQuery);
    if (nextMode) {
      setSearchMode(nextMode);
    }
  }, []);

  const handleOpenProfile = useCallback(
    (profile) => {
      if (profile && profile.id) {
        setProfilesCache((prev) => ({ ...prev, [profile.id]: profile }));
        navigate(`/profil/${profile.id}`);
      }
    },
    [navigate]
  );

  const handleCacheProfile = useCallback((profile) => {
    if (profile && profile.id) {
      setProfilesCache((prev) => ({ ...prev, [profile.id]: profile }));
    }
  }, []);

  const handleSaveSessionPassword = useCallback((profileId, pw) => {
    setSessionPasswords((prev) => ({ ...prev, [profileId]: pw }));
  }, []);

  const handleProfileSaved = useCallback(
    async (saved) => {
      setEditorInitialTab("skills");
      setMyProfile(saved, false);
      setSearchRefreshTick((t) => t + 1);
      try {
        const cat = await apiGet("/api/skills");
        setSkillsCatalog(cat);
      } catch (_) {
        // ignore background catalog refresh errors
      }
    },
    [setMyProfile]
  );

  const handleProfileLoggedIn = useCallback(
    (found) => {
      setEditorInitialTab("skills");
      setMyProfile(found, true);
    },
    [setMyProfile]
  );

  const handleLogout = useCallback(() => {
    setSessionPasswords({});
    setEditorInitialTab("auth");
    setMyProfile(null, true);
    if (window.location.pathname === "/profil") {
      handleStatusChange("Wylogowano z profilu.", false, "Wylogowano");
    }
  }, [setMyProfile, handleStatusChange]);

  const handleJumpToSkillSearch = useCallback(
    (skill, mode) => {
      setSearchQuery(skill);
      setSearchMode(mode || "all");
      navigate("/");
    },
    [navigate]
  );

  return (
    <>
      <Topbar
        activeNav={route.nav}
        myProfile={myProfile}
        onNavigate={navigate}
        onLogout={handleLogout}
        isEditorView={route.view === "editor"}
        showMobileSave={showMobileSave}
        isSaving={isSaving}
        mobileHint={mobileHint}
        mobileHintError={mobileHintError}
      />

      <main className="container" id="app-root">
        {route.view === "home" && (
          <HomeView
            searchQuery={searchQuery}
            searchMode={searchMode}
            skillsCatalog={skillsCatalog}
            profiles={profiles}
            isSearching={isSearching}
            searchError={searchError}
            myProfile={myProfile}
            onSearchChange={handleSearchChange}
            onOpenProfile={handleOpenProfile}
          />
        )}

        {route.view === "editor" && (
          <ProfileEditorView
            myProfile={myProfile}
            profileSyncVersion={profileSyncVersion}
            initialTab={editorInitialTab}
            sessionPasswords={sessionPasswords}
            skillsCatalog={skillsCatalog}
            onSaveSessionPassword={handleSaveSessionPassword}
            onProfileSaved={handleProfileSaved}
            onProfileLoggedIn={handleProfileLoggedIn}
            onLogout={handleLogout}
            onStatusChange={handleStatusChange}
            onSavingChange={setIsSaving}
            onShowMobileSaveChange={setShowMobileSave}
          />
        )}

        {route.view === "detail" && route.profileId && (
          <ProfileDetailView
            profileId={route.profileId}
            cachedProfile={profilesCache[route.profileId] || null}
            onCacheProfile={handleCacheProfile}
            onBackToSearch={() => navigate("/")}
            onJumpToSkillSearch={handleJumpToSkillSearch}
          />
        )}
      </main>

      <MobileNav activeNav={route.nav} myProfile={myProfile} onNavigate={navigate} />
    </>
  );
}
