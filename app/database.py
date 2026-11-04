import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent

PL_CHAR_MAP = str.maketrans(
    {
        "ą": "a",
        "ć": "c",
        "ę": "e",
        "ł": "l",
        "ń": "n",
        "ó": "o",
        "ś": "s",
        "ź": "z",
        "ż": "z",
    }
)


class ProfileAuthError(Exception):
    """Raised when a profile requires a password or the provided password is invalid."""


def get_db_path() -> Path:
    env_path = os.environ.get("BRONET_DB_PATH")
    if env_path:
        return Path(env_path)
    volume_dir = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if volume_dir:
        return Path(volume_dir) / "bronet.db"
    return BASE_DIR / "bronet.db"


def normalize_text(value: str) -> str:
    """Lowercase, collapse whitespace, and strip Polish diacritics for resilient matching."""
    collapsed = " ".join(str(value or "").strip().lower().split())
    return collapsed.translate(PL_CHAR_MAP)


def normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def hash_password(raw_password: str) -> str:
    """Hash any non-empty password with PBKDF2-HMAC-SHA256 (no complexity restrictions)."""
    if not raw_password:
        return ""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("ascii"),
        120_000,
    ).hex()
    return f"{salt}${dk}"


def verify_password(raw_password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return True
    if not raw_password or "$" not in stored_hash:
        return False
    salt, expected_dk = stored_hash.split("$", 1)
    actual_dk = hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt.encode("ascii"),
        120_000,
    ).hex()
    return hmac.compare_digest(actual_dk, expected_dk)


def clean_skills(raw_skills: List[str]) -> List[str]:
    """Split comma-separated entries, trim, and deduplicate while preserving display form."""
    result: List[str] = []
    seen = set()
    for entry in raw_skills or []:
        if not entry:
            continue
        parts = [p.strip().rstrip(".") for p in str(entry).split(",")]
        for part in parts:
            cleaned = " ".join(part.split())
            if not cleaned:
                continue
            norm = normalize_text(cleaned)
            if norm and norm not in seen:
                seen.add(norm)
                result.append(cleaned)
    return result


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


SEED_PROFILES = [
    {
        "name": "Marek",
        "email": "marek@bronet.pl",
        "can_help": ["qa", "it", "związki", "relacje męsko-damskie"],
        "need_help": ["finanse", "sdlc", "realizacja pomysłów"],
        "contact": "marek@bronet.pl",
        "bio": "Tester oprogramowania od 6 lat. Chętnie pomogę wejść w IT lub pogadać o relacjach.",
    },
    {
        "name": "Kasia",
        "email": "kasia@bronet.pl",
        "can_help": ["finanse", "budżet osobisty", "excel", "realizacja pomysłów"],
        "need_help": ["it", "strona www", "angielski"],
        "contact": "kasia@bronet.pl",
        "bio": "Ogarniam finanse osobiste i pomagam przekuwać luźne pomysły w konkretny plan.",
    },
    {
        "name": "Tomek",
        "email": "tomek@bronet.pl",
        "can_help": ["sdlc", "zarządzanie projektami", "it", "architektura systemów"],
        "need_help": ["qa", "relacje męsko-damskie", "trening siłowy"],
        "contact": "tomek@bronet.pl",
        "bio": "Prowadzę zespoły produktowe. Pomogę uporządkować proces wytwarzania oprogramowania.",
    },
    {
        "name": "Ania",
        "email": "ania@bronet.pl",
        "can_help": ["ux/ui", "figma", "angielski", "komunikacja"],
        "need_help": ["finanse", "podatki b2b", "realizacja pomysłów"],
        "contact": "ania@bronet.pl",
        "bio": "Projektuję minimalistyczne interfejsy mobilne i webowe.",
    },
    {
        "name": "Piotr",
        "email": "piotr@bronet.pl",
        "can_help": ["podatki b2b", "umowy", "trening siłowy", "bieganie"],
        "need_help": ["ux/ui", "it", "qa"],
        "contact": "piotr@bronet.pl",
        "bio": "Pomogę z formalnościami na działalności i rozpisaniem prostego planu treningowego.",
    },
]


def init_db(seed: bool = True) -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                name_normalized TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL DEFAULT '',
                contact TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profile_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('can_help', 'need_help')),
                skill TEXT NOT NULL,
                skill_normalized TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id
                ON profile_skills(profile_id);
            CREATE INDEX IF NOT EXISTS idx_profile_skills_norm
                ON profile_skills(kind, skill_normalized);
            """
        )
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(profiles)").fetchall()}
        if "email" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN email TEXT NOT NULL DEFAULT '';")
        if "password_hash" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);")

        if seed:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
            if row and row["cnt"] == 0:
                for item in SEED_PROFILES:
                    _insert_profile_in_tx(conn, item)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_profile_in_tx(conn: sqlite3.Connection, data: Dict[str, Any]) -> int:
    now = _now_iso()
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    raw_password = str(data.get("password") or "")
    pwd_hash = hash_password(raw_password) if raw_password else ""
    contact = str(data.get("contact") or "").strip()
    if not contact and email:
        contact = email

    cur = conn.execute(
        """
        INSERT INTO profiles (name, name_normalized, email, password_hash, contact, bio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            normalize_text(name),
            email,
            pwd_hash,
            contact,
            str(data.get("bio") or "").strip(),
            now,
            now,
        ),
    )
    profile_id = int(cur.lastrowid)
    _save_skills_in_tx(
        conn,
        profile_id,
        clean_skills(data.get("can_help", [])),
        clean_skills(data.get("need_help", [])),
    )
    return profile_id


def _save_skills_in_tx(
    conn: sqlite3.Connection,
    profile_id: int,
    can_help: List[str],
    need_help: List[str],
) -> None:
    conn.execute("DELETE FROM profile_skills WHERE profile_id = ?", (profile_id,))
    rows = []
    for skill in can_help:
        rows.append((profile_id, "can_help", skill, normalize_text(skill)))
    for skill in need_help:
        rows.append((profile_id, "need_help", skill, normalize_text(skill)))
    if rows:
        conn.executemany(
            """
            INSERT INTO profile_skills (profile_id, kind, skill, skill_normalized)
            VALUES (?, ?, ?, ?)
            """,
            rows,
        )


def _hydrate_profiles(conn: sqlite3.Connection, profile_rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    if not profile_rows:
        return []
    ids = [r["id"] for r in profile_rows]
    placeholders = ",".join("?" for _ in ids)
    skill_rows = conn.execute(
        f"""
        SELECT profile_id, kind, skill
        FROM profile_skills
        WHERE profile_id IN ({placeholders})
        ORDER BY id ASC
        """,
        ids,
    ).fetchall()

    by_profile: Dict[int, Dict[str, List[str]]] = {
        pid: {"can_help": [], "need_help": []} for pid in ids
    }
    for sr in skill_rows:
        by_profile[sr["profile_id"]][sr["kind"]].append(sr["skill"])

    hydrated = []
    for r in profile_rows:
        pid = r["id"]
        row_keys = r.keys()
        pwd_hash = r["password_hash"] if "password_hash" in row_keys else ""
        hydrated.append(
            {
                "id": pid,
                "name": r["name"],
                "email": r["email"] if "email" in row_keys else "",
                "has_password": bool(pwd_hash),
                "can_help": by_profile[pid]["can_help"],
                "need_help": by_profile[pid]["need_help"],
                "contact": r["contact"],
                "bio": r["bio"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
        )
    return hydrated


def list_profiles(query: str = "", mode: str = "all") -> List[Dict[str, Any]]:
    q_norm = normalize_text(query)
    with get_connection() as conn:
        all_rows = conn.execute(
            "SELECT * FROM profiles ORDER BY updated_at DESC, id DESC"
        ).fetchall()
        profiles = _hydrate_profiles(conn, all_rows)

    if not q_norm:
        return profiles

    terms = [normalize_text(t) for t in query.split(",") if normalize_text(t)]
    if not terms:
        return profiles

    filtered = []
    for p in profiles:
        can_norms = [normalize_text(s) for s in p["can_help"]]
        need_norms = [normalize_text(s) for s in p["need_help"]]
        name_norm = normalize_text(p["name"])
        bio_norm = normalize_text(p["bio"])

        matched = False
        for term in terms:
            if mode == "can_help":
                if any(term in s for s in can_norms):
                    matched = True
                    break
            elif mode == "need_help":
                if any(term in s for s in need_norms):
                    matched = True
                    break
            else:
                if (
                    any(term in s for s in can_norms)
                    or any(term in s for s in need_norms)
                    or term in name_norm
                    or term in bio_norm
                ):
                    matched = True
                    break
        if matched:
            filtered.append(p)

    return filtered


def get_profile(profile_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            return None
        return _hydrate_profiles(conn, [row])[0]


def authenticate_profile_by_email(email: str, password: str = "") -> Optional[Dict[str, Any]]:
    """
    Load a profile by email, verifying password if the profile has one set.
    Raises ProfileAuthError if the profile is password-protected and password doesn't match.
    """
    cleaned = normalize_email(email)
    if not cleaned:
        return None
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
            (cleaned,),
        ).fetchone()
        if not row:
            return None
        stored_hash = row["password_hash"] or ""
        if stored_hash and not verify_password(password, stored_hash):
            if not password:
                raise ProfileAuthError("Ten profil jest chroniony hasłem — wpisz hasło i kliknij Wczytaj.")
            raise ProfileAuthError("Nieprawidłowe hasło dla tego profilu.")
        return _hydrate_profiles(conn, [row])[0]


def get_profile_by_email(email: str) -> Optional[Dict[str, Any]]:
    return authenticate_profile_by_email(email, password="")


def create_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    email = normalize_email(data.get("email"))
    if email:
        with get_connection() as conn:
            existing_row = conn.execute(
                "SELECT id FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
                (email,),
            ).fetchone()
        if existing_row:
            updated = update_profile(existing_row["id"], data)
            if updated:
                return updated
    with get_connection() as conn:
        profile_id = _insert_profile_in_tx(conn, data)
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        return _hydrate_profiles(conn, [row])[0]


def update_profile(profile_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id, password_hash FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not existing:
            return None

        existing_hash = existing["password_hash"] or ""
        provided_password = str(data.get("password") or "")
        new_password = str(data.get("new_password") or "")

        if existing_hash:
            if not verify_password(provided_password, existing_hash):
                if not provided_password:
                    raise ProfileAuthError("Ten profil ma ustawione hasło — podaj hasło, aby zapisać zmiany.")
                raise ProfileAuthError("Nieprawidłowe hasło — nie można zapisać zmian.")
            effective_hash = hash_password(new_password) if new_password else existing_hash
        else:
            # Profile had no password yet — allow setting one via either `password` or `new_password`
            chosen_pw = new_password or provided_password
            effective_hash = hash_password(chosen_pw) if chosen_pw else ""

        now = _now_iso()
        name = str(data.get("name") or "").strip()
        email = normalize_email(data.get("email"))
        contact = str(data.get("contact") or "").strip()
        if not contact and email:
            contact = email

        conn.execute(
            """
            UPDATE profiles
            SET name = ?, name_normalized = ?, email = ?, password_hash = ?, contact = ?, bio = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                name,
                normalize_text(name),
                email,
                effective_hash,
                contact,
                str(data.get("bio") or "").strip(),
                now,
                profile_id,
            ),
        )
        _save_skills_in_tx(
            conn,
            profile_id,
            clean_skills(data.get("can_help", [])),
            clean_skills(data.get("need_help", [])),
        )
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        return _hydrate_profiles(conn, [row])[0]


def delete_profile(profile_id: int, password: str = "") -> bool:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id, password_hash FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not existing:
            return False
        stored_hash = existing["password_hash"] or ""
        if stored_hash and not verify_password(password, stored_hash):
            if not password:
                raise ProfileAuthError("Ten profil jest chroniony hasłem — podaj hasło, aby go usunąć.")
            raise ProfileAuthError("Nieprawidłowe hasło — nie można usunąć profilu.")
        cur = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        return cur.rowcount > 0


def get_skills_catalog() -> Dict[str, Any]:
    with get_connection() as conn:
        can_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            WHERE kind = 'can_help'
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 25
            """
        ).fetchall()
        need_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            WHERE kind = 'need_help'
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 25
            """
        ).fetchall()
        all_rows = conn.execute(
            """
            SELECT MIN(skill) AS label, skill_normalized, COUNT(*) AS cnt
            FROM profile_skills
            GROUP BY skill_normalized
            ORDER BY cnt DESC, label ASC
            LIMIT 30
            """
        ).fetchall()

    return {
        "all": [{"skill": r["label"], "count": r["cnt"]} for r in all_rows],
        "can_help": [{"skill": r["label"], "count": r["cnt"]} for r in can_rows],
        "need_help": [{"skill": r["label"], "count": r["cnt"]} for r in need_rows],
    }


def _skills_overlap(source_skills: List[str], target_skills: List[str]) -> List[str]:
    target_norms = {normalize_text(t): t for t in target_skills}
    matched: List[str] = []
    seen = set()
    for src in source_skills:
        s_norm = normalize_text(src)
        if not s_norm:
            continue
        if s_norm in target_norms and s_norm not in seen:
            seen.add(s_norm)
            matched.append(src)
    return matched


def get_matches_for_profile(profile_id: int) -> Optional[Dict[str, Any]]:
    me = get_profile(profile_id)
    if not me:
        return None

    others = [p for p in list_profiles() if p["id"] != profile_id]
    mutual = []
    they_help_me = []
    i_help_them = []

    for other in others:
        helped_by_them = _skills_overlap(me["need_help"], other["can_help"])
        helped_by_me = _skills_overlap(me["can_help"], other["need_help"])

        entry = {
            "profile": other,
            "they_can_help_with": helped_by_them,
            "i_can_help_with": helped_by_me,
        }
        if helped_by_them and helped_by_me:
            mutual.append(entry)
        if helped_by_them:
            they_help_me.append(entry)
        if helped_by_me:
            i_help_them.append(entry)

    return {
        "profile": me,
        "mutual": mutual,
        "they_help_me": they_help_me,
        "i_help_them": i_help_them,
    }
