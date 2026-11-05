import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
from contextlib import contextmanager
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


class ProfileValidationError(Exception):
    """Raised when profile data violates platform rules (e.g. non-male name in men-only platform)."""


# Męskie wyjątki imion kończących się na literę 'a'
MALE_EXCEPTIONS_ENDING_IN_A = {
    "kuba", "barnaba", "kosma", "bonawentura", "jarema", "zawisza",
    "akira", "mustafa", "luca", "andrea", "sasha", "eliah"
}

# Popularne polskie imiona i zdrobnienia żeńskie
FEMALE_NAME_TOKENS = {
    "kasia", "basia", "ania", "asia", "gosia", "zosia", "ula", "ola", "magda",
    "madzia", "aga", "agatka", "ewa", "krysia", "kaska", "baska", "anka", "olka",
    "monika", "anna", "maria", "katarzyna", "barbara", "elzbieta", "aleksandra",
    "zofia", "patrycja", "natalia", "karolina", "paulina", "weronika", "klaudia",
    "dominika", "kamila", "kinga", "sandra", "dagmara", "sylwia", "renata",
    "beata", "dorota", "iwona", "marzena", "grazyna", "danuta", "halina",
    "krystyna", "teresa", "jadwiga", "irena", "stanislawa", "janina", "czeslawa",
    "helena", "kazimiera", "genowefa", "marianna", "stefania", "wladyslawa",
    "alina", "bogumila", "wieslawa", "julia", "maja", "zuzanna", "hanna", "lena",
    "alicja", "oliwia", "laura", "pola", "antonina", "wiktoria", "emilia", "nikola",
    "gabriela", "martyna", "izabela", "iza", "lucyna", "bozena", "malgorzata",
    "marcelina", "adriana", "adrianne", "kornelia", "daria", "sonia", "aneta",
    "edyta", "sabina", "marta", "jagoda", "kalina", "roksana", "lilianna",
    "miriam", "carmen", "noemi", "ruth", "beatrice", "ines", "inez"
}


def is_female_name(full_name: str) -> bool:
    """Sprawdza, czy imię jest imieniem żeńskim (platforma jest wyłącznie dla mężczyzn)."""
    if not full_name:
        return False
    cleaned = normalize_text(full_name)
    parts = cleaned.split()
    if not parts:
        return False
    first_token = re.sub(r"[^a-z]", "", parts[0])
    if not first_token:
        return False
    if first_token in FEMALE_NAME_TOKENS:
        return True
    if first_token.endswith("a") and first_token not in MALE_EXCEPTIONS_ENDING_IN_A:
        return True
    return False


def is_female_email(email: str) -> bool:
    """Sprawdza, czy adres e-mail wskazuje na profil żeński (np. kasia@, basia.nowak@)."""
    if not email or "@" not in email:
        return False
    local_part = email.split("@")[0].lower()
    local_tokens = re.sub(r"[^a-z]", " ", normalize_text(local_part)).split()
    if not local_tokens:
        return False
    first = local_tokens[0]
    if first in FEMALE_NAME_TOKENS:
        return True
    if first.endswith("a") and first not in MALE_EXCEPTIONS_ENDING_IN_A:
        return True
    return False


def validate_men_only(name: str, email: str = "") -> None:
    """Weryfikuje regułę men-only — odrzuca żeńskie imiona i adresy e-mail."""
    if is_female_name(name) or is_female_email(email):
        raise ProfileValidationError(
            "Platforma Bronet jest wyłącznie dla facetów (men only). Dozwolone są tylko męskie profile."
        )


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
    conn = sqlite3.connect(str(db_path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


SEED_PROFILES = [
    {
        "name": "Marek",
        "email": "marek@bronet.pl",
        "password": "bronet",
        "can_help": ["qa", "it", "związki", "relacje męsko-damskie"],
        "need_help": ["finanse", "sdlc", "realizacja pomysłów"],
        "contact": "marek@bronet.pl",
        "bio": "Tester oprogramowania od 6 lat. Chętnie pomogę wejść w IT lub pogadać o relacjach.",
    },
    {
        "name": "Kamil",
        "email": "kamil@bronet.pl",
        "password": "bronet",
        "can_help": ["finanse", "budżet osobisty", "excel", "realizacja pomysłów"],
        "need_help": ["it", "strona www", "angielski"],
        "contact": "kamil@bronet.pl",
        "bio": "Ogarniam finanse osobiste i pomagam przekuwać luźne pomysły w konkretny plan.",
    },
    {
        "name": "Tomek",
        "email": "tomek@bronet.pl",
        "password": "bronet",
        "can_help": ["sdlc", "zarządzanie projektami", "it", "architektura systemów"],
        "need_help": ["qa", "relacje męsko-damskie", "trening siłowy"],
        "contact": "tomek@bronet.pl",
        "bio": "Prowadzę zespoły produktowe. Pomogę uporządkować proces wytwarzania oprogramowania.",
    },
    {
        "name": "Michał",
        "email": "michal@bronet.pl",
        "password": "bronet",
        "can_help": ["ux/ui", "figma", "angielski", "komunikacja"],
        "need_help": ["finanse", "podatki b2b", "realizacja pomysłów"],
        "contact": "michal@bronet.pl",
        "bio": "Projektuję minimalistyczne interfejsy mobilne i webowe.",
    },
    {
        "name": "Piotr",
        "email": "piotr@bronet.pl",
        "password": "bronet",
        "can_help": ["podatki b2b", "umowy", "trening siłowy", "bieganie"],
        "need_help": ["ux/ui", "it", "qa"],
        "contact": "piotr@bronet.pl",
        "bio": "Pomogę z formalnościami na działalności i rozpisaniem prostego planu treningowego.",
    },
]


def init_db(seed: bool = True) -> None:
    with get_db() as conn:
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

        # Usunięcie starych profili żeńskich, jeśli istnieją w trwałej bazie (men only)
        rows = conn.execute("SELECT id, name, email FROM profiles").fetchall()
        female_ids = [
            r["id"]
            for r in rows
            if is_female_name(r["name"]) or is_female_email(r["email"])
        ]
        if female_ids:
            ph = ",".join("?" for _ in female_ids)
            conn.execute(f"DELETE FROM profiles WHERE id IN ({ph})", female_ids)

        if seed:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
            current_count = row["cnt"] if row else 0
            if current_count == 0:
                with conn:
                    for item in SEED_PROFILES:
                        _insert_profile_in_tx(conn, item)

            seed_json_path = BASE_DIR / "app" / "seed_profiles.json"
            if seed_json_path.exists():
                cnt_row = conn.execute("SELECT COUNT(*) AS cnt FROM profiles").fetchone()
                if cnt_row and cnt_row["cnt"] < 1500:
                    existing_emails = {
                        r["email"]
                        for r in conn.execute(
                            "SELECT email FROM profiles WHERE email != ''"
                        ).fetchall()
                    }
                    try:
                        with open(seed_json_path, "r", encoding="utf-8") as f:
                            extra_profiles = json.load(f)
                        with conn:
                            for item in extra_profiles:
                                em = normalize_email(item.get("email"))
                                if em and em in existing_emails:
                                    continue
                                _insert_profile_in_tx(conn, item)
                                if em:
                                    existing_emails.add(em)
                    except Exception as err:
                        print(f"Warning: Failed to load seed_profiles.json: {err}")
        invalidate_profiles_cache()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_profile_in_tx(conn: sqlite3.Connection, data: Dict[str, Any]) -> int:
    now = _now_iso()
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    validate_men_only(name, email)
    pwd_hash = data.get("password_hash")
    if not pwd_hash:
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
    by_profile: Dict[int, Dict[str, List[str]]] = {
        pid: {"can_help": [], "need_help": []} for pid in ids
    }
    chunk_size = 500
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        placeholders = ",".join("?" for _ in chunk)
        skill_rows = conn.execute(
            f"""
            SELECT profile_id, kind, skill
            FROM profile_skills
            WHERE profile_id IN ({placeholders})
            ORDER BY id ASC
            """,
            chunk,
        ).fetchall()
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


_CACHE_LOCK = threading.RLock()
_PROFILES_CACHE: Optional[List[Dict[str, Any]]] = None


def invalidate_profiles_cache() -> None:
    global _PROFILES_CACHE
    with _CACHE_LOCK:
        _PROFILES_CACHE = None


def _get_cached_profiles() -> List[Dict[str, Any]]:
    global _PROFILES_CACHE
    with _CACHE_LOCK:
        if _PROFILES_CACHE is None:
            with get_db() as conn:
                all_rows = conn.execute(
                    "SELECT * FROM profiles ORDER BY updated_at DESC, id DESC"
                ).fetchall()
                _PROFILES_CACHE = _hydrate_profiles(conn, all_rows)
        return _PROFILES_CACHE


def list_profiles(query: str = "", mode: str = "all") -> List[Dict[str, Any]]:
    q_norm = normalize_text(query)
    profiles = _get_cached_profiles()

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
        email_norm = normalize_text(p.get("email") or "")
        contact_norm = normalize_text(p.get("contact") or "")
        bio_norm = normalize_text(p["bio"])

        matched = False
        for term in terms:
            if "@" in term:
                contact_tokens = (
                    contact_norm.replace("|", " ").replace(",", " ").replace(";", " ").split()
                )
                is_email_match = (
                    email_norm == term
                    or email_norm.startswith(term)
                    or any(t == term or t.startswith(term) for t in contact_tokens if "@" in t)
                )
            else:
                is_email_match = term in email_norm or term in contact_norm
            if mode == "can_help":
                if any(term in s for s in can_norms) or ("@" in term and is_email_match):
                    matched = True
                    break
            elif mode == "need_help":
                if any(term in s for s in need_norms) or ("@" in term and is_email_match):
                    matched = True
                    break
            else:
                if (
                    any(term in s for s in can_norms)
                    or any(term in s for s in need_norms)
                    or term in name_norm
                    or is_email_match
                    or term in bio_norm
                ):
                    matched = True
                    break
        if matched:
            filtered.append(p)

    return filtered


def get_profile(profile_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            return None
        return _hydrate_profiles(conn, [row])[0]


def authenticate_profile_by_email(email: str, password: str = "") -> Optional[Dict[str, Any]]:
    """
    Load a profile by email, requiring a password.
    If a legacy profile has no password hash yet, sets the provided password on login.
    """
    cleaned = normalize_email(email)
    if not cleaned:
        return None
    if not password:
        raise ProfileAuthError("Podaj hasło.")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
            (cleaned,),
        ).fetchone()
        if not row:
            return None
        stored_hash = row["password_hash"] or ""
        if stored_hash:
            if not verify_password(password, stored_hash):
                raise ProfileAuthError("Nieprawidłowe hasło dla tego profilu.")
        else:
            upgraded_hash = hash_password(password)
            conn.execute(
                "UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?",
                (upgraded_hash, _now_iso(), row["id"]),
            )
            row = conn.execute("SELECT * FROM profiles WHERE id = ?", (row["id"],)).fetchone()
        return _hydrate_profiles(conn, [row])[0]


def get_profile_by_email(email: str) -> Optional[Dict[str, Any]]:
    return authenticate_profile_by_email(email, password="")


def create_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    validate_men_only(name, email)
    if email:
        with get_db() as conn:
            existing_row = conn.execute(
                "SELECT id FROM profiles WHERE email = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
                (email,),
            ).fetchone()
        if existing_row:
            updated = update_profile(existing_row["id"], data)
            if updated:
                return updated
    raw_password = str(data.get("password") or "")
    if not raw_password:
        raise ProfileAuthError("Hasło jest wymagane.")
    with get_db() as conn:
        profile_id = _insert_profile_in_tx(conn, data)
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        hydrated = _hydrate_profiles(conn, [row])[0]
    invalidate_profiles_cache()
    return hydrated


def update_profile(profile_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
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
                    raise ProfileAuthError("Podaj hasło profilu, aby zapisać zmiany.")
                raise ProfileAuthError("Nieprawidłowe hasło — nie można zapisać zmian.")
            effective_hash = hash_password(new_password) if new_password else existing_hash
        else:
            chosen_pw = new_password or provided_password
            if not chosen_pw:
                raise ProfileAuthError("Hasło jest wymagane — ustaw hasło, aby zapisać profil.")
            effective_hash = hash_password(chosen_pw)

        now = _now_iso()
        name = str(data.get("name") or "").strip()
        email = normalize_email(data.get("email"))
        validate_men_only(name, email)
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
        hydrated = _hydrate_profiles(conn, [row])[0]
    invalidate_profiles_cache()
    return hydrated


def delete_profile(profile_id: int, password: str = "") -> bool:
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, password_hash FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
        if not existing:
            return False
        if not password:
            raise ProfileAuthError("Podaj hasło profilu, aby go usunąć.")
        stored_hash = existing["password_hash"] or ""
        if stored_hash and not verify_password(password, stored_hash):
            raise ProfileAuthError("Nieprawidłowe hasło — nie można usunąć profilu.")
        cur = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        success = cur.rowcount > 0
    if success:
        invalidate_profiles_cache()
    return success


def get_skills_catalog() -> Dict[str, Any]:
    with get_db() as conn:
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
    target_norms = {normalize_text(t) for t in target_skills if normalize_text(t)}
    matched: List[str] = []
    seen = set()
    for src in source_skills:
        s_norm = normalize_text(src)
        if not s_norm or s_norm in seen:
            continue
        if s_norm in target_norms:
            seen.add(s_norm)
            matched.append(src)
            continue
        for t_norm in target_norms:
            if len(s_norm) >= 4 and len(t_norm) >= 4 and (s_norm in t_norm or t_norm in s_norm):
                seen.add(s_norm)
                matched.append(src)
                break
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
