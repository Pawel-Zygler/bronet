import React, { useEffect, useRef, useState } from "react";
import { apiGet } from "../api";

/**
 * Generuje syntetyczny fanfar World of Warcraft za pomocą Web Audio API.
 * Nie wymaga zewnętrznych plików audio, działa 100% offline i bezpiecznie w każdej przeglądarce.
 */
function playWowAchievementFanfare() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Klasyczny pochód trąbek WoW Fanfare (akord triumfalny C4 - E4 - G4 - C5 - G5)
    const notes = [
      { freq: 261.63, start: 0.0, dur: 0.22, gain: 0.12 },  // C4
      { freq: 329.63, start: 0.07, dur: 0.22, gain: 0.14 }, // E4
      { freq: 392.00, start: 0.14, dur: 0.32, gain: 0.18 }, // G4
      { freq: 523.25, start: 0.24, dur: 0.95, gain: 0.24 }, // C5 (triumfalne trzymanie)
      { freq: 659.25, start: 0.28, dur: 0.95, gain: 0.18 }, // E5
      { freq: 783.99, start: 0.32, dur: 1.15, gain: 0.22 }, // G5
    ];

    notes.forEach(({ freq, start, dur, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      // Filtr dolnoprzepustowy nadający ciepłe, mosiężne brzmienie blachy
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1600, ctx.currentTime + start);
      filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + start + dur);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.035);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.1);
    });
  } catch (_) {
    // Ciche zignorowanie blokady autoplay przeglądarki
  }
}

export function WowAchievementNotification({ myProfile, onNavigate }) {
  const [activeToast, setActiveToast] = useState(null);
  const queueRef = useRef([]);
  const isDisplayingRef = useRef(false);
  const timerRef = useRef(null);

  const displayNextToast = () => {
    if (queueRef.current.length === 0) {
      setActiveToast(null);
      isDisplayingRef.current = false;
      return;
    }

    isDisplayingRef.current = true;
    const nextAch = queueRef.current.shift();
    setActiveToast(nextAch);

    // Odtwórz fanfary w stylu World of Warcraft
    playWowAchievementFanfare();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      displayNextToast();
    }, 6200);
  };

  const enqueueAchievements = (achievements) => {
    if (!achievements || achievements.length === 0) return;
    queueRef.current.push(...achievements);
    if (!isDisplayingRef.current) {
      displayNextToast();
    }
  };

  // Nasłuchuj zdarzeń z poziomu aplikacji (np. po akcji lub manualnym triggerze)
  useEffect(() => {
    const handleCustomAch = (e) => {
      if (e.detail) {
        if (Array.isArray(e.detail)) {
          enqueueAchievements(e.detail);
        } else {
          enqueueAchievements([e.detail]);
        }
      }
    };
    window.addEventListener("bronet_achievement_unlocked", handleCustomAch);
    return () => window.removeEventListener("bronet_achievement_unlocked", handleCustomAch);
  }, []);

  // Okresowe sprawdzanie nowych osiągnięć zalogowanego profilu (co 6 sekund)
  useEffect(() => {
    if (!myProfile || !myProfile.id) return;

    let isMounted = true;
    const checkNotifications = async () => {
      try {
        const notifs = await apiGet(`/api/achievements/notifications?profile_id=${myProfile.id}`);
        if (isMounted && Array.isArray(notifs) && notifs.length > 0) {
          enqueueAchievements(notifs);
        }
      } catch (_) {}
    };

    // Pierwsze sprawdzenie od razu
    checkNotifications();

    const interval = setInterval(checkNotifications, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [myProfile]);

  const handleDismiss = (e) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    displayNextToast();
  };

  const handleClickToast = () => {
    if (onNavigate) {
      onNavigate("/osiagniecia");
    }
  };

  if (!activeToast) return null;

  const isServerFirst = Boolean(activeToast.is_server_first);
  const rarity = activeToast.rarity || "common";

  return (
    <aside
      className="wow-achievement-notification-root"
      id="wow-achievement-notification-root"
      aria-label="Powiadomienie o osiągnięciu"
      role="status"
      aria-live="polite"
    >
      <div
        className={`wow-achievement-toast rarity-${rarity} ${isServerFirst ? "is-server-first" : ""}`}
        id="wow-achievement-toast"
        onClick={handleClickToast}
        title="Kliknij, aby przejść do Hali Chwały & Osiągnięć"
      >
        {/* Złota wstęga / nagłówek WoW */}
        <div className="wow-toast-ribbon">
          <span className="wow-ribbon-sparkle" aria-hidden="true">★</span>
          <span className="wow-ribbon-text">
            {isServerFirst ? "REALM FIRST! OSIĄGNIĘCIE SERWERA" : "OSIĄGNIĘCIE ZDOBYTE!"}
          </span>
          <span className="wow-ribbon-sparkle" aria-hidden="true">★</span>
        </div>

        <div className="wow-toast-body">
          {/* Herb z ikoną osiągnięcia w stylu medalu WoW */}
          <div className="wow-toast-icon-shield">
            <span className="wow-toast-icon" aria-hidden="true">
              {activeToast.icon || "🏆"}
            </span>
          </div>

          {/* Treść osiągnięcia: Tytuł i opis */}
          <div className="wow-toast-content">
            <h4 className="wow-toast-title" id="wow-toast-title">
              {activeToast.title}
            </h4>
            <p className="wow-toast-desc" id="wow-toast-desc">
              {activeToast.description}
            </p>
          </div>

          {/* Tarcza z punktami prestiżu (Achievement Points Shield) */}
          <div className="wow-toast-points-shield" id="wow-toast-points" title="Punkty osiągnięć">
            <span className="wow-shield-number">+{activeToast.points}</span>
            <span className="wow-shield-label">PKT</span>
          </div>

          {/* Przycisk zamknięcia */}
          <button
            type="button"
            className="wow-toast-close"
            id="wow-toast-close"
            onClick={handleDismiss}
            aria-label="Zamknij powiadomienie"
            title="Zamknij"
          >
            ✕
          </button>
        </div>

        {/* Pasek postępu odliczający 6 sekund do schowania */}
        <div className="wow-toast-progress-bar" aria-hidden="true" />
      </div>
    </aside>
  );
}

