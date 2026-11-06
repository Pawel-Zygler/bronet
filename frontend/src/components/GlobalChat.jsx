import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";

export function GlobalChat({ myProfile, onOpenProfile }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("bronet_global_chat_open");
      if (saved !== null) return saved === "true";
      return window.innerWidth >= 768;
    } catch (_) {
      return true;
    }
  });

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [customNick, setCustomNick] = useState(() => {
    try {
      return localStorage.getItem("bronet_chat_nick") || "";
    } catch (_) {
      return "";
    }
  });
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const messagesEndRef = useRef(null);
  const lastKnownIdRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bronet_global_chat_open", String(next));
      } catch (_) {}
      if (next) {
        setUnreadCount(0);
      }
      return next;
    });
  };

  const fetchMessages = async () => {
    try {
      const data = await apiGet("/api/chat/messages?limit=60");
      if (Array.isArray(data)) {
        if (!isFirstLoadRef.current && !isOpen && data.length > 0) {
          const newOnes = data.filter((m) => m.id > lastKnownIdRef.current);
          if (newOnes.length > 0) {
            setUnreadCount((prev) => prev + newOnes.length);
          }
        }

        if (data.length > 0) {
          const maxId = Math.max(...data.map((m) => m.id));
          lastKnownIdRef.current = maxId;
        }

        setMessages(data);
        isFirstLoadRef.current = false;
      }
    } catch (_) {
      // Ignorujemy błędy połączenia w tle
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleNickChange = (e) => {
    const val = e.target.value;
    setCustomNick(val);
    try {
      localStorage.setItem("bronet_chat_nick", val);
    } catch (_) {}
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setErrorMsg("");

    const author = (myProfile && myProfile.name)
      ? myProfile.name
      : (customNick.trim() || "Chłop");

    const payload = {
      message: text,
      author_name: author,
      profile_id: myProfile ? myProfile.id : null,
    };

    try {
      const created = await apiSend("/api/chat/messages", "POST", payload);
      setInputValue("");
      setMessages((prev) => [...prev, created]);
      lastKnownIdRef.current = Math.max(lastKnownIdRef.current, created.id);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setErrorMsg(err?.message || "Błąd wysyłania.");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  };

  return (
    <aside
      className={`global-chat-widget ${isOpen ? "is-open" : "is-collapsed"}`}
      id="global-chat-widget"
      aria-label="Globalny czat chłopów"
    >
      {/* Pływający przycisk rozwijania (gdy zminimalizowany) */}
      {!isOpen && (
        <button
          type="button"
          id="btn-open-global-chat"
          className="chat-floating-pill"
          onClick={toggleOpen}
          aria-expanded="false"
          aria-controls="chat-window-content"
          title="Otwórz globalny czat"
        >
          <span className="chat-pill-icon" aria-hidden="true">💬</span>
          <span className="chat-pill-text">Global Czat</span>
          <span className="chat-live-pulse-dot" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="chat-unread-badge" id="chat-unread-badge">
              +{unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Okno czatu (zajmujące ok. 1/4 ekranu w lewym dolnym rogu) */}
      {isOpen && (
        <div className="chat-window" id="chat-window-content">
          {/* Belka nagłówkowa */}
          <div className="chat-window-header">
            <div className="chat-header-title-group">
              <span className="chat-header-icon" aria-hidden="true">💬</span>
              <div>
                <h3 className="chat-header-title">Globalny Czat</h3>
                <span className="chat-header-status">
                  <span className="chat-live-dot" aria-hidden="true" />
                  Live na żywo (komputer ↔ telefon)
                </span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                id="btn-close-global-chat"
                className="chat-btn-header-minimize"
                onClick={toggleOpen}
                title="Zminimalizuj czat"
                aria-label="Zminimalizuj czat"
              >
                —
              </button>
            </div>
          </div>

          {/* Subheader z tożsamością usera */}
          <div className="chat-sender-identity-bar">
            {myProfile ? (
              <span className="chat-identity-logged">
                Piszesz jako: <strong>{myProfile.name}</strong>
              </span>
            ) : (
              <div className="chat-identity-guest">
                <label htmlFor="chat-custom-nick">Nick:</label>
                <input
                  type="text"
                  id="chat-custom-nick"
                  className="chat-nick-input"
                  placeholder="np. Chłop z Podlasia"
                  value={customNick}
                  onChange={handleNickChange}
                  maxLength={30}
                />
              </div>
            )}
          </div>

          {/* Lista wiadomości */}
          <div className="chat-messages-container" id="chat-messages-list">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <p>Cisza na radiu... Napisz coś jako pierwszy!</p>
              </div>
            ) : (
              messages.map((m) => {
                const isOwn = myProfile
                  ? m.profile_id === myProfile.id
                  : customNick && m.author_name === customNick;

                return (
                  <div
                    key={m.id}
                    className={`chat-message-row ${isOwn ? "is-own" : "is-other"}`}
                    data-message-id={m.id}
                  >
                    <div className="chat-bubble">
                      <div className="chat-message-meta">
                        {m.profile_id ? (
                          <button
                            type="button"
                            className="chat-author-btn"
                            onClick={() => onOpenProfile(m.profile_id)}
                            title="Zobacz profil"
                          >
                            {m.author_name}
                          </button>
                        ) : (
                          <span className="chat-author-name">{m.author_name}</span>
                        )}
                        <span className="chat-message-time">{formatTime(m.created_at)}</span>
                      </div>
                      <div className="chat-message-body">{m.message}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Komunikat o błędzie */}
          {errorMsg && <div className="chat-alert-error">{errorMsg}</div>}

          {/* Pole wpisywania wiadomości */}
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              id="chat-message-input"
              className="chat-input-field"
              placeholder="Napisz na czacie... (Enter)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSending}
              maxLength={500}
              autoComplete="off"
            />
            <button
              type="submit"
              id="btn-send-chat"
              className="btn btn-primary chat-btn-send"
              disabled={!inputValue.trim() || isSending}
              title="Wyślij wiadomość"
            >
              {isSending ? "..." : "Wyślij"}
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
