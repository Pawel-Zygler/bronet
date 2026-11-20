"""Proste zabezpieczenia warstwy HTTP: limity prób i nagłówki bezpieczeństwa."""

import os
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request


def _rate_limits_enabled() -> bool:
    return os.environ.get("BRONET_RATE_LIMITS", "on").lower() not in ("0", "off", "false", "no")


class RateLimiter:
    """Limit zdarzeń w oknie czasowym, trzymany w pamięci procesu (aplikacja działa w jednym procesie)."""

    def __init__(self, max_events: int, window_seconds: int) -> None:
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> Deque[float]:
        events = self._events[key]
        while events and events[0] <= now - self.window_seconds:
            events.popleft()
        if not events:
            self._events.pop(key, None)
            events = self._events[key]
        return events

    def is_limited(self, key: str) -> Tuple[bool, int]:
        if not _rate_limits_enabled():
            return False, 0
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, now)
            if len(events) >= self.max_events:
                retry_after = int(events[0] + self.window_seconds - now) + 1
                return True, max(retry_after, 1)
            return False, 0

    def hit(self, key: str) -> None:
        if not _rate_limits_enabled():
            return
        now = time.monotonic()
        with self._lock:
            self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()

    def check_and_hit(self, key: str, message: str) -> None:
        limited, retry_after = self.is_limited(key)
        if limited:
            raise HTTPException(status_code=429, detail=message, headers={"Retry-After": str(retry_after)})
        self.hit(key)


# Nieudane logowania: na konto (chroni przed zgadywaniem hasła konkretnej osoby) i na adres IP.
failed_login_per_account = RateLimiter(max_events=10, window_seconds=15 * 60)
failed_login_per_ip = RateLimiter(max_events=50, window_seconds=15 * 60)
# Operacje wymagające hasła (usunięcie profilu, zmiana danych) na profil.
password_checks_per_profile = RateLimiter(max_events=10, window_seconds=15 * 60)
registrations_per_ip = RateLimiter(max_events=60, window_seconds=60 * 60)
chat_messages_per_sender = RateLimiter(max_events=20, window_seconds=60)

ALL_LIMITERS = (
    failed_login_per_account,
    failed_login_per_ip,
    password_checks_per_profile,
    registrations_per_ip,
    chat_messages_per_sender,
)

TOO_MANY_ATTEMPTS = "Zbyt wiele prób. Spróbuj ponownie za kilka minut."


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)


def apply_security_headers(request: Request, headers) -> None:
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("X-Frame-Options", "DENY")
    headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.setdefault("Permissions-Policy", "camera=(), microphone=(), payment=()")
    headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    if request.url.scheme == "https" or forwarded == "https":
        headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
