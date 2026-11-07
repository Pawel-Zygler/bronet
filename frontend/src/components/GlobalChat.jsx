import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../api";

export function GlobalChat({ myProfile, onOpenProfile, directPartner, onClearDirectPartner }) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("bronet_global_chat_open");
      if (saved !== null) return saved === "true";
      return false;
    } catch (_) {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState("global"); // 'global' | 'dm'

  // Global Chat state
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
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Direct Messages state
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInputValue, setDmInputValue] = useState("");
  const [isSendingDm, setIsSendingDm] = useState(false);
  const [dmErrorMsg, setDmErrorMsg] = useState("");
  const [dmStatusInfo, setDmStatusInfo] = useState("");
  const [showNewDmPicker, setShowNewDmPicker] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState([]);

  const messagesEndRef = useRef(null);
  const dmMessagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dmInputRef = useRef(null);
  const lastKnownGlobalIdRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  // Sync with directPartner prop
  useEffect(() => {
    if (directPartner && directPartner.id) {
      setIsOpen(true);
      setActiveTab("dm");
      setSelectedPartner({
        id: directPartner.id,
        name: directPartner.name,
        location_name: directPartner.location_name,
      });
      if (onClearDirectPartner) onClearDirectPartner();
    }
  }, [directPartner, onClearDirectPartner]);

  // Listen to global open DM event
  useEffect(() => {
    const handleOpenDmEvent = (e) => {
      if (e.detail && e.detail.id) {
        setIsOpen(true);
        setActiveTab("dm");
        setSelectedPartner({
          id: e.detail.id,
          name: e.detail.name,
          location_name: e.detail.location_name,
        });
      }
    };
    window.addEventListener("bronet_open_dm", handleOpenDmEvent);
    return () => window.removeEventListener("bronet_open_dm", handleOpenDmEvent);
  }, []);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bronet_global_chat_open", String(next));
      } catch (_) {}
      if (next) {
        setGlobalUnreadCount(0);
      }
      return next;
    });
  };

  // Fetch Global Chat messages
  const fetchGlobalMessages = async () => {
    try {
      const data = await apiGet("/api/chat/messages?limit=60");
      if (Array.isArray(data)) {
        if (!isFirstLoadRef.current && (!isOpen || activeTab !== "global") && data.length > 0) {
          const newOnes = data.filter((m) => m.id > lastKnownGlobalIdRef.current);
          if (newOnes.length > 0) {
            setGlobalUnreadCount((prev) => prev + newOnes.length);
          }
        }

        if (data.length > 0) {
          const maxId = Math.max(...data.map((m) => m.id));
          lastKnownGlobalIdRef.current = maxId;
        }

        setMessages(data);
        isFirstLoadRef.current = false;
      }
    } catch (_) {}
  };

  // Fetch DM unread count
  const fetchDmUnreadCount = async () => {
    if (!myProfile?.id) {
      setDmUnreadCount(0);
      return;
    }
    try {
      const res = await apiGet(`/api/dm/unread-count?profile_id=${myProfile.id}`);
      if (res && typeof res.unread_count === "number") {
        setDmUnreadCount(res.unread_count);
      }
    } catch (_) {}
  };

  // Fetch conversations list
  const fetchConversations = async () => {
    if (!myProfile?.id) return;
    try {
      const list = await apiGet(`/api/dm/conversations?profile_id=${myProfile.id}`);
      if (Array.isArray(list)) {
        setConversations(list);
      }
    } catch (_) {}
  };

  // Fetch messages with selected partner
  const fetchPartnerMessages = async (partnerId) => {
    if (!myProfile?.id || !partnerId) return;
    try {
      const data = await apiGet(`/api/dm/messages/${partnerId}?profile_id=${myProfile.id}&mark_read=true`);
      if (Array.isArray(data)) {
        setDmMessages(data);
        fetchDmUnreadCount();
      }
    } catch (_) {}
  };

  // Load profiles for starting a new DM
  const fetchAvailableProfiles = async () => {
    try {
      const all = await apiGet("/api/profiles");
      if (Array.isArray(all)) {
        const others = all.filter((p) => !myProfile || p.id !== myProfile.id);
        setAvailableProfiles(others);
      }
    } catch (_) {}
  };

  // Main polling loop
  useEffect(() => {
    fetchGlobalMessages();
    fetchDmUnreadCount();

    if (activeTab === "dm" && myProfile?.id) {
      if (selectedPartner) {
        fetchPartnerMessages(selectedPartner.id);
      } else {
        fetchConversations();
      }
    }

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchGlobalMessages();
      fetchDmUnreadCount();

      if (activeTab === "dm" && myProfile?.id) {
        if (selectedPartner) {
          fetchPartnerMessages(selectedPartner.id);
        } else {
          fetchConversations();
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, activeTab, selectedPartner?.id, myProfile?.id]);

  // Auto-scroll global messages
  useEffect(() => {
    if (isOpen && activeTab === "global") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  // Auto-scroll DM messages
  useEffect(() => {
    if (isOpen && activeTab === "dm" && selectedPartner) {
      dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, isOpen, activeTab, selectedPartner]);

  const handleNickChange = (e) => {
    const val = e.target.value;
    setCustomNick(val);
    try {
      localStorage.setItem("bronet_chat_nick", val);
    } catch (_) {}
  };

  // Mention author in input field: @name
  const handleMentionAuthor = (rawName) => {
    if (!rawName) return;
    const cleanName = rawName.replace(/^@+/, "").trim();
    if (!cleanName) return;

    if (activeTab === "dm" && selectedPartner) {
      setDmInputValue((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return `@${cleanName} `;
        if (trimmed.includes(`@${cleanName}`)) return prev;
        return `${trimmed} @${cleanName} `;
      });
      setTimeout(() => {
        dmInputRef.current?.focus();
      }, 40);
    } else {
      setInputValue((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return `@${cleanName} `;
        if (trimmed.includes(`@${cleanName}`)) return prev;
        return `${trimmed} @${cleanName} `;
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }
  };

  // Send message in Global Chat
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setErrorMsg("");

    const author = myProfile && myProfile.name ? myProfile.name : customNick.trim() || "Chłop";

    const payload = {
      message: text,
      author_name: author,
      profile_id: myProfile ? myProfile.id : null,
    };

    try {
      const created = await apiSend("/api/chat/messages", "POST", payload);
      setInputValue("");
      setMessages((prev) => [...prev, created]);
      lastKnownGlobalIdRef.current = Math.max(lastKnownGlobalIdRef.current, created.id);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setErrorMsg(err?.message || "Błąd wysyłania.");
    } finally {
      setIsSending(false);
    }
  };

  // Send Direct Message (DM)
  const handleSendDm = async (e) => {
    if (e) e.preventDefault();
    const text = dmInputValue.trim();
    if (!text || isSendingDm || !selectedPartner || !myProfile?.id) return;

    setIsSendingDm(true);
    setDmErrorMsg("");

    try {
      const created = await apiSend(`/api/dm/messages/${selectedPartner.id}`, "POST", {
        message: text,
        profile_id: myProfile.id,
      });
      setDmInputValue("");
      setDmMessages((prev) => [...prev, created]);
      setTimeout(() => {
        dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      fetchConversations();
    } catch (err) {
      setDmErrorMsg(err?.message || "Nie udało się wysłać wiadomości prywatnej.");
    } finally {
      setIsSendingDm(false);
    }
  };

  // Clear conversation history with partner
  const handleClearHistory = async () => {
    if (!selectedPartner || !myProfile?.id) return;
    const ok = window.confirm(
      `Czy na pewno chcesz wyczyścić całą historię czatu z ${selectedPartner.name}?`
    );
    if (!ok) return;

    try {
      await apiSend(
        `/api/dm/conversations/${selectedPartner.id}?profile_id=${myProfile.id}`,
        "DELETE"
      );
      setDmMessages([]);
      setDmStatusInfo("Historia konwersacji została wyczyszczona.");
      setTimeout(() => setDmStatusInfo(""), 3000);
      fetchConversations();
    } catch (err) {
      setDmErrorMsg(err?.message || "Nie udało się wyczyścić historii.");
    }
  };

  // Delete single message from DM thread
  const handleDeleteDmMessage = async (msgId) => {
    if (!myProfile?.id) return;
    try {
      await apiSend(`/api/dm/messages/${msgId}?profile_id=${myProfile.id}`, "DELETE");
      setDmMessages((prev) => prev.filter((m) => m.id !== msgId));
      fetchConversations();
    } catch (err) {
      setDmErrorMsg(err?.message || "Nie udało się usunąć wiadomości.");
    }
  };

  // Select a partner to open conversation
  const handleSelectPartner = (partner) => {
    setSelectedPartner(partner);
    setDmStatusInfo("");
    setDmErrorMsg("");
    fetchPartnerMessages(partner.id);
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

  const totalUnreadAll = globalUnreadCount + dmUnreadCount;

  return (
    <aside
      className={`global-chat-widget ${isOpen ? "is-open" : "is-collapsed"}`}
      id="global-chat-widget"
      aria-label="Czat i wiadomości chłopów"
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
          title="Otwórz czat i wiadomości"
        >
          <span className="chat-pill-icon" aria-hidden="true">💬</span>
          <span className="chat-pill-text">Czat Chłopów</span>
          <span className="chat-live-pulse-dot" aria-hidden="true" />
          {totalUnreadAll > 0 && (
            <span className="chat-unread-badge" id="chat-unread-badge">
              +{totalUnreadAll}
            </span>
          )}
        </button>
      )}

      {/* Okno czatu (responsywne na komputerze i telefonie) */}
      {isOpen && (
        <div className="chat-window chat-responsive-window" id="chat-window-content">
          {/* Główna belka nagłówkowa */}
          <div className="chat-window-header">
            <div className="chat-header-title-group">
              <span className="chat-header-icon" aria-hidden="true">💬</span>
              <div>
                <h3 className="chat-header-title">Globalny Czat &amp; Wiadomości</h3>
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

          {/* Przełącznik zakładek: [💬 Globalny Czat] | [✉️ Prywatne (DM)] */}
          <div className="chat-tabs-bar" role="tablist">
            <button
              type="button"
              role="tab"
              id="chat-tab-global"
              className={`chat-tab-btn ${activeTab === "global" ? "is-active" : ""}`}
              aria-selected={activeTab === "global"}
              onClick={() => {
                setActiveTab("global");
                setGlobalUnreadCount(0);
              }}
            >
              💬 Globalny Czat
              {globalUnreadCount > 0 && (
                <span className="chat-tab-badge">+{globalUnreadCount}</span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              id="chat-tab-dm"
              className={`chat-tab-btn ${activeTab === "dm" ? "is-active" : ""}`}
              aria-selected={activeTab === "dm"}
              onClick={() => {
                setActiveTab("dm");
                if (myProfile?.id) {
                  fetchConversations();
                  fetchDmUnreadCount();
                }
              }}
            >
              ✉️ Prywatne (DM)
              {dmUnreadCount > 0 && (
                <span className="chat-tab-badge" id="chat-dm-unread-badge">
                  {dmUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* ======================= ZAKŁADKA 1: GLOBALNY CZAT ======================= */}
          {activeTab === "global" && (
            <>
              {/* Pasek tożsamości nadawcy */}
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

              {/* Lista wiadomości globalnych */}
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
                            <div className="chat-author-mention-group">
                              <button
                                type="button"
                                className="chat-author-btn"
                                onClick={() => handleMentionAuthor(m.author_name)}
                                title={`Oznacz @${m.author_name} w wiadomości`}
                                data-mention-author={m.author_name}
                              >
                                @{m.author_name}
                              </button>
                              {m.profile_id && (
                                <button
                                  type="button"
                                  className="chat-profile-icon-btn"
                                  onClick={() => onOpenProfile(m.profile_id)}
                                  title={`Zobacz profil: ${m.author_name}`}
                                >
                                  👤
                                </button>
                              )}
                              {myProfile && m.profile_id && m.profile_id !== myProfile.id && (
                                <button
                                  type="button"
                                  className="chat-quick-dm-icon-btn"
                                  onClick={() => {
                                    handleSelectPartner({
                                      id: m.profile_id,
                                      name: m.author_name,
                                    });
                                    setActiveTab("dm");
                                  }}
                                  title={`Napisz na priv do ${m.author_name}`}
                                >
                                  ✉️
                                </button>
                              )}
                            </div>
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

              {/* Formularz wpisywania wiadomości */}
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  ref={inputRef}
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
            </>
          )}

          {/* ======================= ZAKŁADKA 2: PRYWATNE (DIRECT MESSAGES) ======================= */}
          {activeTab === "dm" && (
            <div className="chat-dm-tab-content">
              {!myProfile ? (
                <div className="chat-dm-login-prompt">
                  <div className="chat-dm-lock-icon" aria-hidden="true">🔒</div>
                  <h4>Wiadomości prywatne 1:1</h4>
                  <p>
                    Aby pisać wiadomości prywatne do innych chłopów, załóż profil lub zaloguj się na swoje konto.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenProfile("new")}
                  >
                    Załóż profil chłopa
                  </button>
                </div>
              ) : selectedPartner ? (
                /* Wątek 1:1 z wybranym partnerem (Messenger/LinkedIn thread) */
                <div className="chat-dm-thread" id="chat-dm-thread">
                  {/* Belka konwersacji */}
                  <div className="chat-dm-thread-header">
                    <button
                      type="button"
                      id="btn-back-to-conversations"
                      className="chat-dm-back-btn"
                      onClick={() => {
                        setSelectedPartner(null);
                        fetchConversations();
                        fetchDmUnreadCount();
                      }}
                      title="Wróć do listy rozmów"
                    >
                      ← Wróć
                    </button>

                    <div className="chat-dm-partner-info">
                      <span className="chat-dm-partner-name">
                        <strong>{selectedPartner.name}</strong>
                        {selectedPartner.location_name && (
                          <span className="chat-dm-partner-loc">📍 {selectedPartner.location_name}</span>
                        )}
                      </span>
                    </div>

                    <div className="chat-dm-thread-actions">
                      <button
                        type="button"
                        className="chat-dm-action-link"
                        onClick={() => onOpenProfile(selectedPartner.id)}
                        title="Otwórz profil tego użytkownika"
                      >
                        👤 Profil
                      </button>
                      <button
                        type="button"
                        id="btn-clear-dm-history"
                        className="chat-dm-action-danger"
                        onClick={handleClearHistory}
                        title="Wyczyść całą historię rozmowy"
                      >
                        🗑️ Wyczyść
                      </button>
                    </div>
                  </div>

                  {dmStatusInfo && (
                    <div className="chat-alert-info" role="status">
                      {dmStatusInfo}
                    </div>
                  )}

                  {/* Lista wiadomości 1:1 */}
                  <div className="chat-messages-container chat-dm-messages" id="chat-dm-messages-list">
                    {dmMessages.length === 0 ? (
                      <div className="chat-empty-state">
                        <p>Rozpocznij prywatną rozmowę z {selectedPartner.name}!</p>
                        <span className="label-sub">
                          Wiadomości są bezpiecznie zachowywane w historii Twojego konta.
                        </span>
                      </div>
                    ) : (
                      dmMessages.map((m) => {
                        const isOwn = m.sender_id === myProfile.id;
                        return (
                          <div
                            key={m.id}
                            className={`chat-message-row ${isOwn ? "is-own" : "is-other"}`}
                            data-dm-id={m.id}
                          >
                            <div className="chat-bubble">
                              <div className="chat-message-meta">
                                <button
                                  type="button"
                                  className="chat-author-btn"
                                  onClick={() => handleMentionAuthor(m.sender_name)}
                                  title={`Oznacz @${m.sender_name} w wiadomości`}
                                >
                                  @{m.sender_name}
                                </button>
                                <span className="chat-message-time">
                                  {formatTime(m.created_at)}
                                  <button
                                    type="button"
                                    className="chat-dm-delete-msg-btn"
                                    onClick={() => handleDeleteDmMessage(m.id)}
                                    title="Usuń tę wiadomość"
                                    aria-label="Usuń tę wiadomość"
                                  >
                                    ×
                                  </button>
                                </span>
                              </div>
                              <div className="chat-message-body">{m.message}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={dmMessagesEndRef} />
                  </div>

                  {dmErrorMsg && <div className="chat-alert-error">{dmErrorMsg}</div>}

                  {/* Formularz wpisywania wiadomości prywatnej */}
                  <form className="chat-input-form" onSubmit={handleSendDm}>
                    <input
                      ref={dmInputRef}
                      type="text"
                      id="chat-dm-message-input"
                      className="chat-input-field"
                      placeholder={`Napisz prywatnie do ${selectedPartner.name}...`}
                      value={dmInputValue}
                      onChange={(e) => setDmInputValue(e.target.value)}
                      disabled={isSendingDm}
                      maxLength={500}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      id="btn-send-dm"
                      className="btn btn-primary chat-btn-send"
                      disabled={!dmInputValue.trim() || isSendingDm}
                      title="Wyślij wiadomość prywatną"
                    >
                      {isSendingDm ? "..." : "Wyślij"}
                    </button>
                  </form>
                </div>
              ) : (
                /* Lista konwersacji (Messenger/LinkedIn inbox) */
                <div className="chat-conversations-screen" id="chat-conversations-list">
                  <div className="chat-convs-header-bar">
                    <span className="chat-convs-title">Rozmowy prywatne ({conversations.length})</span>
                    <button
                      type="button"
                      id="chat-btn-new-dm"
                      className="btn btn-outline btn-sm chat-btn-new-dm"
                      onClick={() => {
                        setShowNewDmPicker((prev) => !prev);
                        if (!showNewDmPicker) fetchAvailableProfiles();
                      }}
                    >
                      {showNewDmPicker ? "✕ Zamknij" : "+ Nowa rozmowa"}
                    </button>
                  </div>

                  {/* Picker do rozpoczęcia rozmowy z dowolnym profilem */}
                  {showNewDmPicker && (
                    <div className="chat-new-dm-picker" id="chat-new-dm-picker-box">
                      <div className="label-sub" style={{ marginBottom: 6 }}>
                        Wybierz chłopa z bazy, aby rozpocząć czat:
                      </div>
                      <select
                        id="chat-select-new-dm-partner"
                        className="chat-new-dm-select"
                        defaultValue=""
                        onChange={(e) => {
                          const targetId = Number(e.target.value);
                          if (!targetId) return;
                          const chosen = availableProfiles.find((p) => p.id === targetId);
                          if (chosen) {
                            handleSelectPartner(chosen);
                            setShowNewDmPicker(false);
                          }
                        }}
                      >
                        <option value="" disabled>-- Wybierz profil --</option>
                        {availableProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.location_name ? `(${p.location_name})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Lista aktywnych wątków */}
                  <div className="chat-convs-list-items">
                    {conversations.length === 0 ? (
                      <div className="chat-empty-state">
                        <p>Brak historii prywatnych rozmów.</p>
                        <p className="label-sub">
                          Kliknij <strong>+ Nowa rozmowa</strong> powyżej lub wejdź na profil chłopa i wybierz <em>"Napisz na priv"</em>.
                        </p>
                      </div>
                    ) : (
                      conversations.map((conv) => (
                        <div
                          key={conv.partner_id}
                          className={`chat-conv-item ${conv.unread_count > 0 ? "has-unread" : ""}`}
                          onClick={() =>
                            handleSelectPartner({
                              id: conv.partner_id,
                              name: conv.partner_name,
                              location_name: conv.partner_location,
                            })
                          }
                          data-partner-id={conv.partner_id}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleSelectPartner({
                                id: conv.partner_id,
                                name: conv.partner_name,
                                location_name: conv.partner_location,
                              });
                            }
                          }}
                        >
                          <div className="chat-conv-avatar" aria-hidden="true">
                            {conv.partner_name ? conv.partner_name.charAt(0).toUpperCase() : "👤"}
                          </div>
                          <div className="chat-conv-details">
                            <div className="chat-conv-top-line">
                              <span className="chat-conv-name">{conv.partner_name}</span>
                              <span className="chat-conv-time">{formatTime(conv.last_message_time)}</span>
                            </div>
                            <div className="chat-conv-bottom-line">
                              <span className="chat-conv-snippet">
                                {conv.last_message || "Rozpoczęto rozmowę"}
                              </span>
                              {conv.unread_count > 0 && (
                                <span className="chat-conv-badge">+{conv.unread_count}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
