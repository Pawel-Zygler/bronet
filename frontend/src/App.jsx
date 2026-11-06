import React, { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api";
import { MobileNav } from "./components/MobileNav";
import { Topbar } from "./components/Topbar";
import { GlobalStatsView } from "./views/GlobalStatsView";
import { HomeView } from "./views/HomeView";
import { MatchingView } from "./views/MatchingView";
import { ProfileDetailView } from "./views/ProfileDetailView";
import { ProfileEditorView } from "./views/ProfileEditorView";
import { RankingsView } from "./views/RankingsView";

const STORAGE_KEY_MY_PROFILE = "bronet_my_profile_id";
const STORAGE_KEY_MY_PROFILE_CACHE = "bronet_my_profile_cache";
const STORAGE_KEY_COMPACT_VIEW = "bronet_compact_view";

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
  if (pathname === "/dopasowania") {
    return { view: "matches", nav: "matches", profileId: null };
  }
  if (pathname === "/chlopchain" || pathname === "/statystyki" || pathname === "/mapa") {
    return { view: "chlopchain", nav: "chlopchain", profileId: null };
  }
  if (pathname === "/rankingi" || pathname === "/ranking") {
    return { view: "rankings", nav: "rankings", profileId: null };
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
  const [immediateSearchTick, setImmediateSearchTick] = useState(0);

  const [isCompactView, setIsCompactView] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COMPACT_VIEW) === "true";
    } catch (_) {
      return false;
    }
  });

  const handleToggleCompactView = useCallback(() => {
    setIsCompactView((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COMPACT_VIEW, String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Mobile sticky save bar state
  const [showMobileSave, setShowMobileSave] = useState(Boolean(myProfile));
  const [isSaving, setIsSaving] = useState(false);
  const [mobileHint, setMobileHint] = useState("");
  const [mobileHintError, setMobileHintError] = useState(false);
  const mobileHintTimerRef = useRef(null);

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
    const fallbackShort = isError ? (message.length > 16 ? "Sprawdź błędy" : message) : "Zapisano ✓";
    setMobileHint(mobileShort || fallbackShort);
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
      startTransition(() => {
        setPathname(window.location.pathname);
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (pathname === "/mapa" || pathname === "/statystyki") {
      window.history.replaceState({}, "", "/chlopchain");
      setPathname("/chlopchain");
    }
  }, [pathname]);

  // Initial boot: fetch skills catalog + active profile in parallel
  useEffect(() => {
    const savedId = Number(localStorage.getItem(STORAGE_KEY_MY_PROFILE)) || null;

    apiGet("/api/skills")
      .then((cat) => setSkillsCatalog(cat))
      .catch(() => {});

    if (savedId) {
      apiGet(`/api/profiles/${savedId}`)
        .then((p) => {
          setMyProfile(p, true);
        })
        .catch(() => {
          setMyProfile(null, true);
        });
    }
  }, [setMyProfile]);

  // Reactive search with AbortController (0ms when Enter pressed, 100ms debounce while typing)
  const prevImmediateRef = useRef(0);
  const activeReqIdRef = useRef(0);
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const isImmediate = immediateSearchTick !== prevImmediateRef.current;
    prevImmediateRef.current = immediateSearchTick;
    const reqId = ++activeReqIdRef.current;

    const controller = new AbortController();
    setSearchError("");

    const delay = isImmediate || !trimmed ? 0 : 100;
    const timer = setTimeout(() => {
      setIsSearching(true);
      const url = trimmed
        ? `/api/profiles?q=${encodeURIComponent(trimmed)}&mode=${encodeURIComponent(searchMode)}`
        : `/api/profiles?mode=${encodeURIComponent(searchMode)}`;
      apiGet(url, controller.signal)
        .then((list) => {
          if (reqId !== activeReqIdRef.current) return;
          setProfiles(Array.isArray(list) ? list : []);
          setProfilesCache((prev) => {
            const next = { ...prev };
            if (Array.isArray(list)) {
              list.forEach((p) => {
                next[p.id] = p;
              });
            }
            return next;
          });
        })
        .catch((err) => {
          if (reqId !== activeReqIdRef.current) return;
          if (err.name !== "AbortError") {
            setSearchError(err.message || "Błąd wyszukiwania");
          }
        })
        .finally(() => {
          if (reqId === activeReqIdRef.current) {
            setIsSearching(false);
          }
        });
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, searchMode, searchRefreshTick, immediateSearchTick]);

  const handleSearchChange = useCallback((nextQuery, nextMode) => {
    setSearchQuery(nextQuery);
    if (nextMode) {
      setSearchMode(nextMode);
    }
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setImmediateSearchTick((t) => t + 1);
  }, []);

  const handleOpenProfile = useCallback(
    (profileOrId) => {
      if (!profileOrId) return;
      const id = typeof profileOrId === "object" ? profileOrId.id : Number(profileOrId);
      if (id) {
        if (typeof profileOrId === "object") {
          setProfilesCache((prev) => ({ ...prev, [id]: profileOrId }));
        }
        navigate(`/profil/${id}`);
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
      setMyProfile(found, true);
    },
    [setMyProfile]
  );

  const handleLogout = useCallback(() => {
    setSessionPasswords({});
    setMyProfile(null, true);
    if (window.location.pathname === "/profil") {
      handleStatusChange("Wylogowano z profilu.", false, "Wylogowano");
    }
  }, [setMyProfile, handleStatusChange]);

  const handleProfileDeleted = useCallback(
    async (deletedId) => {
      setSessionPasswords({});
      setProfiles((prev) => prev.filter((p) => p.id !== deletedId));
      setProfilesCache((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      setMyProfile(null, true);
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

  const handleJumpToSkillSearch = useCallback(
    (skill, mode) => {
      setSearchQuery(skill);
      setSearchMode(mode || "all");
      setImmediateSearchTick((t) => t + 1);
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
        isCompactView={isCompactView}
        onToggleCompactView={handleToggleCompactView}
      />

      <main
        className={`container ${
          route.view === "chlopchain" || route.view === "stats"
            ? "container-wide"
            : ""
        }`}
        id="app-root"
        tabIndex={-1}
      >
        {route.view === "home" && (
          <HomeView
            searchQuery={searchQuery}
            searchMode={searchMode}
            skillsCatalog={skillsCatalog}
            profiles={profiles}
            isSearching={isSearching}
            searchError={searchError}
            myProfile={myProfile}
            isCompactView={isCompactView}
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSearchSubmit}
            onOpenProfile={handleOpenProfile}
          />
        )}

        {route.view === "matches" && (
          <MatchingView
            myProfile={myProfile}
            isCompactView={isCompactView}
            onOpenProfile={handleOpenProfile}
            onNavigate={navigate}
            profiles={profiles}
          />
        )}

        {(route.view === "chlopchain" || route.view === "stats") && (
          <GlobalStatsView
            onOpenProfile={handleOpenProfile}
            onNavigate={navigate}
          />
        )}

        {route.view === "rankings" && (
          <RankingsView
            onOpenProfile={handleOpenProfile}
            onNavigate={navigate}
          />
        )}

        {route.view === "editor" && (
          <ProfileEditorView
            myProfile={myProfile}
            profileSyncVersion={profileSyncVersion}
            sessionPasswords={sessionPasswords}
            skillsCatalog={skillsCatalog}
            onSaveSessionPassword={handleSaveSessionPassword}
            onProfileSaved={handleProfileSaved}
            onProfileLoggedIn={handleProfileLoggedIn}
            onProfileDeleted={handleProfileDeleted}
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
            myProfile={myProfile}
            sessionPasswords={sessionPasswords}
            onCacheProfile={handleCacheProfile}
            onBackToSearch={() => navigate("/")}
            onJumpToSkillSearch={handleJumpToSkillSearch}
            onRefreshMyProfile={() => {
              if (myProfile && myProfile.id) {
                apiGet(`/api/profiles/${myProfile.id}`)
                  .then((fresh) => setMyProfile(fresh, false))
                  .catch(() => {});
              }
            }}
          />
        )}
      </main>

      <MobileNav activeNav={route.nav} myProfile={myProfile} onNavigate={navigate} />
    </>
  );
}
